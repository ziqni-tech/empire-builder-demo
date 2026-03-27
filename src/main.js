import { ApiClientStomp, MembersApiWs, MemberRequest } from '@ziqni-tech/member-api-client'
import dashboardTemplate from './templates/dashboard.hbs'
import {fetchMissionsSummary} from "./missionService";
import { manageOptIn, getOptInStatus } from './optInService';
import { fetchAwardsSummary, claimAward, getAwardsByIds } from './awardService';

const state = {
    playerName: 'Player-1',
    connectionStatus: 'disconnected',
    statusLabel: 'Connecting...',
    events: [],
    stages: [],
    availableAwards: [],
    claimedAwards: [],
}

function render () {
  document.body.innerHTML = dashboardTemplate(state)
}

function findAvailableAwards(availableAwards) {
  availableAwards.forEach(award => {
    const awardItem = document.querySelector(`[data-id="${award.rewardId}"]`)
    if (awardItem) {
      awardItem.classList.add('available')
      const labelItem = awardItem.querySelector('.stage-item-progress')
      labelItem.classList.add('available')
      labelItem.setAttribute('data-award-id', award.id)
      labelItem.innerHTML = 'CLAIM'
    }
  })
}

function findClaimedAwards(claimedAwards) {
  claimedAwards.forEach(award => {
    const awardItem = document.querySelector(`[data-id="${award.rewardId}"]`)
    if (awardItem) {
      awardItem.classList.add('claimed')
      const labelItem = awardItem.querySelector('.stage-item-progress')
      labelItem.classList.add('claimed')
      labelItem.innerHTML = ''
    }
  })
}

function setClaimEvents(apiClientStomp) {
  const claimButtons = document.querySelectorAll('.stage-item-progress.available')
  const winDrawer = document.querySelector('.completed-drawer-wrapp')
  const  winDrawerClose = winDrawer.querySelector('.completed-drawer-close')

  winDrawerClose.addEventListener('click', () => {
    winDrawer.classList.remove('active')
  })

  if (claimButtons && claimButtons.length) {
    claimButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const awardId = btn.getAttribute('data-award-id')

        if (btn.classList.contains('no-after')) {
          winDrawer.classList.add('active')
        } else {
          await claimAward(apiClientStomp, awardId, function () {
            setTimeout(function () {
              initApp();
            }, 3500)
          });
        }
      })
    })
  }
}

function resetState(newPlayerName) {
    state.playerName = newPlayerName;
    state.connectionStatus = 'disconnected';
    state.statusLabel = 'Connecting...';
    state.events = [];
    state.stages = [];
    state.availableAwards = [];
    state.claimedAwards = [];
}

function attachSwitcherEvents() {
    const switchBtn = document.querySelector('.eb-player-switcher__btn');
    const input = document.querySelector('.eb-player-switcher__input');

    if (switchBtn && input) {
        switchBtn.addEventListener('click', () => {
            const newName = input.value.trim();
            if (newName && newName !== state.playerName) {
                resetState(newName);
                initApp();
            }
        });
    }
}

function missionItemUpdateProgression(id, percentageComplete) {
  const stage = document.querySelector(`.stage-item-wrapp[data-id="${id}"]`)

  if (!stage) return;

  const label = stage.querySelector('.stage-item-progress')
  label.innerHTML =  percentageComplete + '/100';

  if (percentageComplete === 100) {
    setTimeout(async () => {
      resetState(state.playerName);
      initApp();
    }, 1000);
  }
}

async function initApp () {
    render()
    attachSwitcherEvents();

    try {
        const apiClientStomp = ApiClientStomp.instance

        if (apiClientStomp.client && apiClientStomp.client.connected) {
            await apiClientStomp.disconnect();
        }

        const memberTokenRequest = {
            member: state.playerName,
            apiKey: 'eyJhbGciOiJIUzUxMiJ9.eyJhcGlfa2V5X2lkIjoiX2JxUUlwd0JacnFwVXlmV1dyYmwiLCJtZW1iZXJfcmVmZXJlbmNlX2lkIjoiWEFQSSIsImFjY291bnRfaWQiOiJUcjhWRUp3QjZvams0cENvZElNUCIsInNwYWNlX25hbWUiOiJjYWVzYXJzIiwibmFtZSI6IlhBUEkiLCJtZW1iZXJfdHlwZSI6IlhBUEkiLCJtZW1iZXJfaWQiOiIzMWUzNDFmMi1iYzJiLTRkZTItYWNlMi1iOWUzZWIwMDM2M2MiLCJyZXNvdXJjZV9hY2Nlc3MiOnsiemlxbmktYWFwaSI6eyJyb2xlcyI6WyJDcmVhdGVNZW1iZXJUb2tlbiJdfX0sInR5cCI6IngtYXBpLWtleSIsInN1YiI6IjMxZTM0MWYyLWJjMmItNGRlMi1hY2UyLWI5ZTNlYjAwMzYzYyIsImp0aSI6ImYyMWM3OTg4LTY1ZGQtNDYyMy1iNmVkLTI4MzEwZDE3ZGQwNyIsImlhdCI6MTc3MDEwNjQxMSwiZXhwIjoxODAxNjQyNDExLCJhenAiOiJjYWVzYXJzLnppcW5pLmFwcCJ9.zquL5x76aev40NTqEWncPl94WqIjvPpMPFfh2IlRJQ_DcN7USDg_F8_rLvPqNAEWrXKLusN6CnzZdq-JiDE_YQ',
            isReferenceId: true,
            expires: 360000000,
            resource: 'ziqni-gapi'
        };
        const response = await fetch('https://member-api.ziqni.com/member-token', {
            method: 'post',
            body: JSON.stringify(memberTokenRequest),
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            }
        });
        const body = await response.json();
        apiClientStomp.client.debug = () => { };
        await apiClientStomp.connect({ token: body.data.jwtToken })

        state.connectionStatus = 'connected'
        state.statusLabel = 'Connected'

        const result = await fetchMissionsSummary({
          apiClient: apiClientStomp,
          language: 'en',
          currencyKey: 'USD',
          pageNumber: 1,
          itemsPerPage: 6
        })

        if (result.missions.length) {
          const mission = result.missions[0];
          mission.isCompleted = mission.optInStatus.percentageComplete === 100;
          state.stages.push(mission);
          if (mission.dependencies && mission.dependencies.length) {
            mission.dependencies.forEach(dependency => {
              if (dependency.achievement.includes.iconLink) {
                dependency.achievement.iconLink = dependency.achievement.includes.iconLink;
              }

              dependency.achievement.isCompleted = dependency.achievement.optInStatus.percentageComplete === 100;

              state.stages.push(dependency.achievement)
            })
          }
        }

      render()
      attachSwitcherEvents();

      apiClientStomp.sendSys('', {}, (json, headers) => {
            if (headers && headers.objectType === 'Error') {
              console.warn('Error')
              console.warn('json', json)
              console.warn('headers', headers)
              // this.settings.callbacks.onStompError(json);
            }

            if (json && json.entityType === 'Award') {
              console.log('Sys Award', json)
            }

            if (json && json.entityType === 'Achievement') {
              console.log('Sys Achievement', json)
              if (headers.callback === 'optinStatus') {
                console.log('optinStatus')
                missionItemUpdateProgression(json.entityId, json.percentageComplete);
              }
            }
        });

      const optInBtn = document.querySelector('.bottom-action');
      optInBtn.addEventListener('click', async () => {
        await manageOptIn({
          apiClient: apiClientStomp,
          entityId: state.stages[0].id,
          entityType: 'Achievement',
          action: 'join'
        })
      })

      const { claimed, available, expired } = await fetchAwardsSummary({
        apiClient: apiClientStomp,
        language: 'en',
        currencyKey: 'USD',
        availablePage: 1,
        claimedPage: 1,
        expiredPage: 1,
        pageSize: 20,
        rewardsPageSize: 20
      })

      state.availableAwards = available.awards
      state.claimedAwards = claimed.awards

      findAvailableAwards(state.availableAwards)
      findClaimedAwards(state.claimedAwards)
      setClaimEvents(apiClientStomp)

      console.log('state:', state)
    } catch (err) {
        console.log('something went wrong', err)
    }
}

initApp()
