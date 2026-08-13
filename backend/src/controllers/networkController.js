import {
  acceptConnectionRequest,
  blockUser,
  declineConnectionRequest,
  followCompany,
  getCompanyFollowStatus,
  getMutualConnections,
  getNetworkConnections,
  getNetworkPrivacy,
  getNetworkSuggestions,
  getProfessionalProfile,
  getReceivedConnectionRequests,
  getSentConnectionRequests,
  searchPeople,
  sendConnectionRequest,
  unblockUser,
  unfollowCompany,
  updateNetworkPrivacy,
  withdrawConnectionRequest,
  removeConnection,
} from '../services/networkService.js';
import { sendSuccess } from '../utils/response.js';

export async function listConnections(req, res, next) {
  try {
    const result = await getNetworkConnections(req.user, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function listReceivedRequests(req, res, next) {
  try {
    const result = await getReceivedConnectionRequests(req.user, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function listSentRequests(req, res, next) {
  try {
    const result = await getSentConnectionRequests(req.user, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function createRequest(req, res, next) {
  try {
    const result = await sendConnectionRequest(req.user, req.body);
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function acceptRequest(req, res, next) {
  try {
    const result = await acceptConnectionRequest(req.user, req.params.requestId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function declineRequest(req, res, next) {
  try {
    const result = await declineConnectionRequest(req.user, req.params.requestId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteRequest(req, res, next) {
  try {
    const result = await withdrawConnectionRequest(req.user, req.params.requestId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteConnection(req, res, next) {
  try {
    const result = await removeConnection(req.user, req.params.connectionId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function createBlock(req, res, next) {
  try {
    const result = await blockUser(req.user, req.params.userId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteBlock(req, res, next) {
  try {
    const result = await unblockUser(req.user, req.params.userId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function listMutualConnections(req, res, next) {
  try {
    const result = await getMutualConnections(req.user, req.params.userId, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function listSuggestions(req, res, next) {
  try {
    const result = await getNetworkSuggestions(req.user, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function searchPeopleController(req, res, next) {
  try {
    const result = await searchPeople(req.user, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getPeopleProfile(req, res, next) {
  try {
    const result = await getProfessionalProfile(req.user, req.params.userId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getPrivacy(req, res, next) {
  try {
    const result = await getNetworkPrivacy(req.user);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function patchPrivacy(req, res, next) {
  try {
    const result = await updateNetworkPrivacy(req.user, req.body);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function createCompanyFollow(req, res, next) {
  try {
    const result = await followCompany(req.user, req.body.organisationId);
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteCompanyFollow(req, res, next) {
  try {
    const result = await unfollowCompany(req.user, req.params.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCompanyFollow(req, res, next) {
  try {
    const following = await getCompanyFollowStatus(req.user.id, req.params.organisationId);
    sendSuccess(res, 200, { following });
  } catch (error) {
    next(error);
  }
}
