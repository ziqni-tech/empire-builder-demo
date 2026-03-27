import {
  AwardsApiWs,
  AwardRequest,
  ClaimAwardRequest
} from '@ziqni-tech/member-api-client';
import { getRewards } from './rewardService';

export const AWARD_STATUS_RANGES = {
  available: { moreThan: 14, lessThan: 16 },
  claimed: { moreThan: 34, lessThan: 36 },
  expired: { moreThan: 114, lessThan: 116 }
};

let awardsApiWsClient = null;

const getAwardsApi = async function (apiClient, awardRequest) {
  if (!awardsApiWsClient) {
    awardsApiWsClient = new AwardsApiWs(apiClient);
  }
  return new Promise((resolve, reject) => {
    awardsApiWsClient.getAwards(awardRequest, (json) => { resolve(json); });
  });
};

const buildAwardRequest = ({
   language,
   currencyKey,
   statusRange,
   skip,
   limit,
   ids
 }) => {
  const awardFilter = {
    ids: ids,
    sortBy: [{
      queryField: 'created',
      order: 'Desc'
    }],
    skip: skip,
    limit: limit
  };

  if (statusRange) {
    awardFilter.statusCode = statusRange;
  }

  return AwardRequest.constructFromObject({
    languageKey: language,
    currencyKey: currencyKey,
    awardFilter
  }, null);
};

export async function getAwards({
  apiClient,
  language,
  currencyKey,
  moreThan,
  lessThan,
  skip,
  limit
}) {
  const request = buildAwardRequest({
    language,
    currencyKey,
    statusRange: { moreThan, lessThan },
    skip,
    limit
  });

  return await getAwardsApi(apiClient, request);
}

export async function getAwardsByIds({
 apiClient,
 language,
 currencyKey,
 ids
}) {
  const request = buildAwardRequest({
    language,
    currencyKey,
    ids: ids,
    statusRange: null,
    skip: 0,
    limit: (ids && ids.length) ? ids.length : 1
  });

  return await getAwardsApi(apiClient, request);
}

const attachRewardData = (awards, rewardsData) => {
  if (!rewardsData || !rewardsData.length) {
    return awards;
  }

  const rewardsMap = rewardsData.reduce((acc, reward) => {
    acc[reward.id] = reward;
    return acc;
  }, {});

  return awards.map((award) => {
    if (rewardsMap[award.rewardId]) {
      award.rewardData = rewardsMap[award.rewardId];
    }
    return award;
  });
};

export async function fetchAwardsByStatus({
  apiClient,
  language,
  currencyKey,
  statusRange,
  page = 1,
  pageSize = 6,
  rewardsPageSize = 20
}) {
  const awardsResponse = await getAwards({
    apiClient,
    language,
    currencyKey,
    moreThan: statusRange.moreThan,
    lessThan: statusRange.lessThan,
    skip: (page - 1) * pageSize,
    limit: pageSize
  });

  const awardsData = awardsResponse.data || [];
  const rewardIds = awardsData.map((a) => a.rewardId).filter(Boolean);

  let rewardsData = [];
  if (rewardIds.length) {
    const rewards = await getRewards({
      apiClient,
      languageKey: language,
      currencyKey,
      entityType: 'Reward',
      entityIds: rewardIds,
      skip: 0,
      limit: rewardsPageSize
    });
    rewardsData = rewards.data || [];
  }

  return {
    awards: attachRewardData(awardsData, rewardsData),
    totalCount: (awardsResponse.meta && awardsResponse.meta.totalRecordsFound) ? awardsResponse.meta.totalRecordsFound : 0
  };
}

export async function fetchAwardsSummary({
   apiClient,
   language,
   currencyKey,
   availablePage = 1,
   claimedPage = 1,
   expiredPage = 1,
   pageSize = 6,
   rewardsPageSize = 20
 }) {
  const [claimed, available, expired] = await Promise.all([
    fetchAwardsByStatus({
      apiClient,
      language,
      currencyKey,
      statusRange: AWARD_STATUS_RANGES.claimed,
      page: claimedPage,
      pageSize,
      rewardsPageSize
    }),
    fetchAwardsByStatus({
      apiClient,
      language,
      currencyKey,
      statusRange: AWARD_STATUS_RANGES.available,
      page: availablePage,
      pageSize,
      rewardsPageSize
    }),
    fetchAwardsByStatus({
      apiClient,
      language,
      currencyKey,
      statusRange: AWARD_STATUS_RANGES.expired,
      page: expiredPage,
      pageSize,
      rewardsPageSize
    })
  ]);

  return {
    claimed,
    available,
    expired
  };
}

export async function claimAward(apiClient, rewardId, callback) {
  if (!awardsApiWsClient) {
    awardsApiWsClient = new AwardsApiWs(apiClient);
  }

  const claimAwardRequest = ClaimAwardRequest.constructFromObject({
    awardIds: [rewardId]
  });

  awardsApiWsClient.claimAwards(claimAwardRequest, (json) => {
    if (typeof callback === 'function') {
      callback(json);
    }
  });
}
