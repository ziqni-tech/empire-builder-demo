import {
  OptInApiWs,
  OptInStatesRequest,
  ManageOptinRequest
} from '@ziqni-tech/member-api-client';

let optInApiWsClient = null;

const manageOptIn = async ({ apiClient, entityId, entityType, action }) => {
  if (!optInApiWsClient) {
    optInApiWsClient = new OptInApiWs(apiClient);
  }

  const optInRequest = ManageOptinRequest.constructFromObject({
    entityId: entityId,
    entityType: entityType,
    action: action
  }, null);

  return new Promise((resolve, reject) => {
    optInApiWsClient.manageOptin(optInRequest, (json) => {
      resolve(json);
    });
  });
};

const getOptInStatus = async ({
  apiClient,
  entityTypes,
  ids,
  statusCodes = { gt: -5, lt: 40 },
  skip = 0,
  limit = 1
}) => {
  if (!optInApiWsClient) {
    optInApiWsClient = new OptInApiWs(apiClient);
  }

  const optInStatesRequest = OptInStatesRequest.constructFromObject({
    optinStatesFilter: {
      entityTypes: entityTypes,
      ids: ids,
      statusCodes: statusCodes,
      skip: skip,
      limit: limit
    }
  }, null);

  return new Promise((resolve, reject) => {
    optInApiWsClient.optInStates(optInStatesRequest, (json) => {
      resolve(json.data);
    });
  });
};

export { manageOptIn, getOptInStatus };
