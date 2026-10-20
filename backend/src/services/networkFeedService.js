import { prisma } from '../config/db.js';

// Network feed (recruiters and candidates): posts written by the viewer's
// accepted connections, plus posts those connections liked or shared, with
// like/share counts for the viewer to act on.

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 30;

function clampPageSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.round(n)));
}

function buildError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

async function getConnectionUserIds(userId) {
  const rows = await prisma.userConnection.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterUserId: userId }, { receiverUserId: userId }],
    },
    select: { requesterUserId: true, receiverUserId: true },
  });
  return rows.map((row) => (row.requesterUserId === userId ? row.receiverUserId : row.requesterUserId));
}

function displayName(user) {
  return user?.candidateProfile?.fullName || user?.name || user?.email?.split('@')[0] || 'Member';
}

function authorSummary(author) {
  const isRecruiter = author?.role === 'RECRUITER' || author?.role === 'RECRUITER_ADMIN';
  return {
    userId: author?.id || null,
    name: displayName(author),
    subtitle: isRecruiter
      ? (author?.recruiterProfile?.designation || 'Recruiter')
      : (author?.candidateProfile?.headline || author?.candidateProfile?.currentTitle || 'Candidate'),
    role: isRecruiter ? 'RECRUITER' : 'CANDIDATE',
  };
}

const personSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  candidateProfile: { select: { fullName: true, headline: true, currentTitle: true } },
  recruiterProfile: { select: { designation: true } },
};

const postInclude = {
  authorUser: { select: personSelect },
  reactions: {
    select: {
      userId: true,
      type: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, candidateProfile: { select: { fullName: true } } } },
    },
  },
};

function serializePost(post, viewerId, connectionIds, sortAt) {
  const likes = post.reactions.filter((reaction) => reaction.type === 'LIKE');
  const shares = post.reactions.filter((reaction) => reaction.type === 'SHARE');
  // "X liked / shared this": the most recent action by someone in the viewer's network.
  const networkActivity = post.reactions
    .filter((reaction) => connectionIds.has(reaction.userId) && reaction.userId !== post.authorUserId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;

  return {
    id: `net_${post.id}`,
    postId: post.id,
    content: post.content,
    imageUrl: post.imageUrl || null,
    createdAt: post.createdAt.toISOString(),
    sortAt: sortAt.toISOString(),
    canDelete: post.authorUserId === viewerId,
    author: authorSummary(post.authorUser),
    likeCount: likes.length,
    shareCount: shares.length,
    viewerLiked: likes.some((reaction) => reaction.userId === viewerId),
    viewerShared: shares.some((reaction) => reaction.userId === viewerId),
    activity: networkActivity
      ? {
        type: networkActivity.type === 'SHARE' ? 'SHARED' : 'LIKED',
        byName: displayName(networkActivity.user),
      }
      : null,
  };
}

// Newest-first items for the viewer's network feed, over-fetched to `windowSize`
// so callers can page (or merge with other sources) in memory.
export async function collectNetworkFeedItems(user, windowSize) {
  const connectionList = await getConnectionUserIds(user.id);
  const connectionIds = new Set(connectionList);
  const audience = [...connectionList, user.id];

  const [authored, reacted, ownShares] = await Promise.all([
    prisma.feedPost.findMany({
      where: { authorUserId: { in: audience }, status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: windowSize,
      include: postInclude,
    }),
    connectionList.length
      ? prisma.feedPostReaction.findMany({
        where: { userId: { in: connectionList }, post: { status: 'PUBLISHED' } },
        orderBy: { createdAt: 'desc' },
        take: windowSize,
        select: { createdAt: true, post: { include: postInclude } },
      })
      : Promise.resolve([]),
    prisma.feedPostReaction.findMany({
      where: { userId: user.id, type: 'SHARE', post: { status: 'PUBLISHED' } },
      orderBy: { createdAt: 'desc' },
      take: windowSize,
      select: { createdAt: true, post: { include: postInclude } },
    }),
  ]);

  // One entry per post, positioned by its most recent event (authored / liked / shared).
  const byPost = new Map();
  const remember = (post, sortAt) => {
    const existing = byPost.get(post.id);
    if (!existing || sortAt > existing.sortAt) byPost.set(post.id, { post, sortAt });
  };
  authored.forEach((post) => remember(post, post.createdAt));
  reacted.forEach((row) => remember(row.post, row.createdAt));
  ownShares.forEach((row) => remember(row.post, row.createdAt));

  return {
    connectionCount: connectionList.length,
    items: [...byPost.values()]
      .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
      .map(({ post, sortAt }) => serializePost(post, user.id, connectionIds, sortAt)),
  };
}

export async function getNetworkFeed(user, { page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const take = clampPageSize(pageSize);
  const currentPage = Math.max(1, Number(page) || 1);
  const skip = (currentPage - 1) * take;

  const { items, connectionCount } = await collectNetworkFeedItems(user, skip + take + 1);

  return {
    items: items.slice(skip, skip + take),
    meta: {
      page: currentPage,
      pageSize: take,
      hasMore: items.length > skip + take,
      connectionCount,
    },
  };
}

// Toggles the viewer's LIKE or SHARE on a post they can see (their own, a
// connection's, or one a connection liked/shared). Returns the fresh counts.
export async function toggleFeedReaction(user, postId, type) {
  if (!['LIKE', 'SHARE'].includes(type)) {
    throw buildError('INVALID_REACTION', 'Reaction must be LIKE or SHARE.', 422);
  }
  const post = await prisma.feedPost.findUnique({ where: { id: postId } });
  if (!post || post.status !== 'PUBLISHED') {
    throw buildError('POST_NOT_FOUND', 'Post not found.', 404);
  }

  const connectionList = await getConnectionUserIds(user.id);
  const visible = post.authorUserId === user.id
    || connectionList.includes(post.authorUserId)
    || Boolean(await prisma.feedPostReaction.findFirst({ where: { postId, userId: { in: connectionList } }, select: { id: true } }));
  if (!visible) {
    throw buildError('POST_NOT_FOUND', 'Post not found.', 404);
  }

  const key = { postId_userId_type: { postId, userId: user.id, type } };
  const existing = await prisma.feedPostReaction.findUnique({ where: key });
  if (existing) {
    await prisma.feedPostReaction.delete({ where: key });
  } else {
    await prisma.feedPostReaction.create({ data: { postId, userId: user.id, type } });
  }

  const [likeCount, shareCount] = await Promise.all([
    prisma.feedPostReaction.count({ where: { postId, type: 'LIKE' } }),
    prisma.feedPostReaction.count({ where: { postId, type: 'SHARE' } }),
  ]);
  return { postId, type, active: !existing, likeCount, shareCount };
}
