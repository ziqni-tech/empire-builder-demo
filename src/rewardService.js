import { RewardsApiWs } from '@ziqni-tech/member-api-client';

let rewardsApiWsClient = null;

const getRewardsApi = async function (apiClient, achievementRequest) {
  if (!rewardsApiWsClient) {
    rewardsApiWsClient = new RewardsApiWs(apiClient);
  }
  return new Promise((resolve, reject) => {
    rewardsApiWsClient.getRewards(achievementRequest, (json) => { resolve(json); });
  });
};

const getRewards = async function ({ apiClient, languageKey, currencyKey, entityType, entityIds, skip, limit }) {
  const request = {
    languageKey: languageKey,
    entityFilter: [{
      entityType: entityType,
      entityIds: entityIds
    }],
    currencyKey: currencyKey,
    skip: skip,
    limit: limit
  };

  return await getRewardsApi(apiClient, request);
};

const attachRewards = async function ({ apiClient, entityArray, languageKey, currencyKey, entityType, entityIds, skip, limit }) {
  const rewards = await getRewards({ apiClient, languageKey, currencyKey, entityType, entityIds, skip, limit });
  const rewardsData = rewards.data;

  entityArray = entityArray.map(c => {
    c.rewards = rewardsData.filter(r => r.entityId === c.id);
    return c;
  });

  return entityArray;
};

const attachReward = async function ({ apiClient, entityArray, languageKey, currencyKey, entityType, entityIds, skip, limit }) {
  const rewards = await getRewards({ apiClient, languageKey, currencyKey, entityType, entityIds, skip, limit });
  const rewardsData = rewards.data;

  entityArray = entityArray.map(entity => {
    const idx = rewardsData.findIndex(r => r.entityId === entity.id);
    if (idx !== -1) {
      entity.reward = rewardsData[idx];
    }

    return entity;
  });

  return entityArray;
};

export { getRewards, attachRewards, attachReward };
