import { prisma } from '../config/db.js';

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

function candidateDisplayName(user) {
  return user?.candidateProfile?.fullName || user?.fullName || user?.email || 'Candidate';
}

// Returns a merged, newest-first timeline combining:
//  - published OrganisationPost rows from companies the user follows, and
//  - the user's own published FeedPost rows.
// Simple offset pagination keeps the two sources correctly interleaved by date.
export async function getCandidateFeed(user, { page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const take = clampPageSize(pageSize);
  const currentPage = Math.max(1, Number(page) || 1);
  const skip = (currentPage - 1) * take;

  const follows = await prisma.companyFollow.findMany({
    where: { userId: user.id },
    select: { organisationId: true },
  });
  const followedOrgIds = follows.map((f) => f.organisationId);

  // Over-fetch a window from both sources, merge by date, then page in memory.
  const windowSize = skip + take + 1;

  const [orgPosts, ownPosts] = await Promise.all([
    followedOrgIds.length
      ? prisma.organisationPost.findMany({
        where: { organisationId: { in: followedOrgIds }, status: 'PUBLISHED' },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: windowSize,
        include: { organisation: { select: { id: true, name: true, slug: true, logoUrl: true, industry: true } } },
      })
      : Promise.resolve([]),
    prisma.feedPost.findMany({
      where: { authorUserId: user.id, status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: windowSize,
    }),
  ]);

  const items = [
    ...orgPosts.map((post) => ({
      id: `org_${post.id}`,
      postId: post.id,
      type: 'ORGANISATION',
      content: post.content,
      imageUrl: post.imageUrl || null,
      createdAt: post.publishedAt || post.createdAt,
      canDelete: false,
      author: {
        name: post.organisation?.name || 'Company',
        subtitle: post.organisation?.industry || 'Company update',
        logoUrl: post.organisation?.logoUrl || null,
        organisationSlug: post.organisation?.slug || null,
        organisationId: post.organisation?.id || null,
        userId: null,
      },
    })),
    ...ownPosts.map((post) => ({
      id: `me_${post.id}`,
      postId: post.id,
      type: 'CANDIDATE',
      content: post.content,
      imageUrl: post.imageUrl || null,
      createdAt: post.createdAt,
      canDelete: true,
      author: {
        name: candidateDisplayName(user),
        subtitle: user?.candidateProfile?.headline || user?.candidateProfile?.currentTitle || 'You',
        logoUrl: null,
        organisationSlug: null,
        organisationId: null,
        userId: user.id,
      },
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pageItems = items.slice(skip, skip + take);
  const hasMore = items.length > skip + take;

  return {
    items: pageItems.map((item) => ({ ...item, createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null })),
    meta: {
      page: currentPage,
      pageSize: take,
      hasMore,
      followedCompanyCount: followedOrgIds.length,
    },
  };
}

export async function createFeedPost(user, payload = {}) {
  const content = String(payload.content || '').trim();
  if (!content) {
    throw buildError('EMPTY_POST', 'Write something to share before posting.', 422);
  }
  if (content.length > 4000) {
    throw buildError('POST_TOO_LONG', 'Posts are limited to 4000 characters.', 422);
  }
  const imageUrl = payload.imageUrl ? String(payload.imageUrl).trim() : null;
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw buildError('INVALID_IMAGE_URL', 'Image URL must start with http:// or https://', 422);
  }

  const post = await prisma.feedPost.create({
    data: { authorUserId: user.id, content, imageUrl, status: 'PUBLISHED' },
  });

  return {
    id: `me_${post.id}`,
    postId: post.id,
    type: 'CANDIDATE',
    content: post.content,
    imageUrl: post.imageUrl || null,
    createdAt: post.createdAt.toISOString(),
    canDelete: true,
    author: {
      name: candidateDisplayName(user),
      subtitle: user?.candidateProfile?.headline || user?.candidateProfile?.currentTitle || 'You',
      logoUrl: null,
      userId: user.id,
    },
  };
}

export async function deleteFeedPost(user, postId) {
  const post = await prisma.feedPost.findUnique({ where: { id: postId } });
  if (!post || post.authorUserId !== user.id) {
    throw buildError('POST_NOT_FOUND', 'Post not found.', 404);
  }
  await prisma.feedPost.update({ where: { id: postId }, data: { status: 'ARCHIVED' } });
  return { id: postId, deleted: true };
}
