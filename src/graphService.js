import { GraphsApiWs, EntityGraphRequest } from '@ziqni-tech/member-api-client';

let graphsApiWsClient = null;

const getGraphApi = async function (apiClient, graphRequest) {
  if (!graphsApiWsClient) {
    graphsApiWsClient = new GraphsApiWs(apiClient);
  }

  return new Promise((resolve, reject) => {
    graphsApiWsClient.getGraph(graphRequest, (json) => {
      resolve(json);
    });
  });
};

export async function getGraph({ apiClient, ids, includes, isDependantId = false }) {
  const request = EntityGraphRequest.constructFromObject({
    ids: ids,
    includes: includes,
    isDependantId: isDependantId
  });

  return await getGraphApi(apiClient, request);
}
