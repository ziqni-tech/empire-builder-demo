import { AchievementsApiWs, AchievementRequest } from '@ziqni-tech/member-api-client';
import { getGraph } from './graphService';
import { getRewards, attachReward } from './rewardService';

let achievementsApiWsClient = null;

const getAchievementsApi = async function (apiClient, achievementRequest) {
  if (!achievementsApiWsClient) {
    achievementsApiWsClient = new AchievementsApiWs(apiClient);
  }
  return new Promise((resolve, reject) => {
    achievementsApiWsClient.getAchievements(achievementRequest, (json) => { resolve(json); });
  });
};

export async function getAchievements({
  apiClient,
  language,
  productTags = [],
  productIds = [],
  tags = [],
  startDate = null,
  endDate = null,
  ids = [],
  scheduleTypes = [],
  moreThan = 10,
  lessThan = 30,
  skip = 0,
  limit = 6,
  constraints = []
}) {
  const request = AchievementRequest.constructFromObject({
    languageKey: language,
    achievementFilter: {
      productTags: productTags,
      productIds: productIds,
      tags: tags,
      startDate: startDate,
      endDate: endDate,
      ids: ids,
      scheduleTypes: scheduleTypes,
      statusCode: {
        moreThan: moreThan,
        lessThan: lessThan
      },
      sortBy: [{
        queryField: 'created',
        order: 'Desc'
      }],
      skip: skip,
      limit: limit,
      constraints: constraints
    }
  }, null);

  return await getAchievementsApi(apiClient, request);
}

async function enrichMissionWithDependencies({
 apiClient,
 language,
 currencyKey,
 mission,
 graphIncludes = ['scheduling', 'bannerLink', 'iconLink'],
 dependencyRewardsLimit = 5
}) {
  if (!mission) {
    return mission;
  }

  mission.dependencies = [];

  const graphResponse = await getGraph({
    apiClient,
    ids: [mission.id],
    includes: graphIncludes
  });
  const graph = graphResponse.data;

  if (graph.graphs[0] && graph.graphs[0].edges && graph.graphs[0].edges.length) {
    const filtered = graph.graphs[0].edges.filter(edge => edge.graphEdgeType !== 'ROOT');

    for (const edge of filtered) {
      const idx = graph.nodes.findIndex(n => n.entityId === edge.tailEntityId);
      const achievement = graph.nodes[idx];

      if (achievement) {
        const rewards = await getRewards({
          apiClient,
          languageKey: language,
          currencyKey,
          entityType: 'Achievement',
          entityIds: [edge.tailEntityId],
          skip: 0,
          limit: dependencyRewardsLimit
        });
        const rewardsData = rewards.data;

        achievement.reward = rewardsData && rewardsData[0] ? rewardsData[0] : null;

        mission.dependencies.push({
          ordering: edge.ordering,
          achievement: achievement
        });
      }
    }
  }

  return mission;
}

async function enrichMissionsWithRewardsAndDependencies({
  apiClient,
  language,
  currencyKey,
  missions,
  rewardsLimit = 20,
  graphIncludes = ['scheduling', 'bannerLink', 'iconLink'],
  dependencyRewardsLimit = 5
}) {
if (!missions || !missions.length) {
return missions;
}

const ids = missions.map(m => m.id);

const enrichedMissions = await attachReward({
apiClient,
languageKey: language,
entityArray: missions,
currencyKey,
entityType: 'Achievement',
entityIds: ids,
skip: 0,
limit: rewardsLimit
});

for (let i = 0; i < enrichedMissions.length; i++) {
enrichedMissions[i] = await enrichMissionWithDependencies({
apiClient,
language,
currencyKey,
mission: enrichedMissions[i],
graphIncludes,
dependencyRewardsLimit
});
}

return enrichedMissions;
}

export async function fetchMissionsSummary({
   apiClient,
   language,
   currencyKey,
   pageNumber = 1,
   itemsPerPage = ITEMS_PER_PAGE.MISSIONS,
   rewardsLimit = 20,
   graphIncludes = ['scheduling', 'bannerLink', 'iconLink'],
   dependencyRewardsLimit = 5
 }) {
  const skip = (pageNumber - 1) * itemsPerPage;

  const response = await getAchievements({
    apiClient,
    language,
    moreThan: 20,
    lessThan: 30,
    skip,
    limit: itemsPerPage,
    constraints: ['mission']
  });

  const missions = response.data || [];
  const totalCount = response.meta?.totalRecordsFound || 0;

  let enrichedMissions = missions;

  if (missions.length) {
    enrichedMissions = await enrichMissionsWithRewardsAndDependencies({
      apiClient,
      language,
      currencyKey,
      missions,
      rewardsLimit,
      graphIncludes,
      dependencyRewardsLimit
    });
  }

  return {
    missions: enrichedMissions,
    totalCount
  };
}
