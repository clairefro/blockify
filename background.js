const SPOTIFY_URL = "open.spotify.com/";
const SPOTIFY_AD_TITLE = "Spotify – Advertisement";

const random = (arr) => {
  return arr[Math.floor(Math.random() * arr.length)];
};

class MusicPlayer {
  constructor() {
    this.currentlyPlaying = null;
  }

  audioUrls = [
    "music/ThinkingFree.mp3",
    "music/RockHopping.mp3",
    "music/Cheeky.mp3",
    "music/HereForYears.mp3",
    "music/lofi-study.mp3",
  ];

  playRandom() {
    const audioPath = random(this.audioUrls);
    const audio = new Audio(audioPath);
    audio.volume = 0.8;
    this.currentlyPlaying = audio;
    audio.play();
  }

  stop() {
    if (this.currentlyPlaying) {
      this.currentlyPlaying.pause();
      this.currentlyPlaying = null;
    }
  }
}

const fillerMusic = new MusicPlayer();

const titleIsAd = (title) => {
  const adRegex = new RegExp(`^${SPOTIFY_AD_TITLE}`);
  return !!title.match(adRegex);
};

const mute = (tabId) => {
  chrome.tabs.update(tabId, { muted: true });
};

const unmute = (tabId) => {
  chrome.tabs.update(tabId, { muted: false });
};

// create a blank tab for launching play of bg music without being muted
const playFillerInNewTab = () => {
  chrome.tabs.create({ url: "", active: false }, (tab) => {
    fillerMusic.playRandom();
    chrome.tabs.remove(tab.id);
  });
};

const checkForAd = (tabId, _changeInfo, tab) => {
  if (tab.url.match(SPOTIFY_URL)) {
    if (titleIsAd(tab.title)) {
      if (!tab.mutedInfo.muted) {
        mute(tabId);
        playFillerInNewTab();
      }
    } else {
      if (tab.mutedInfo.muted) {
        unmute(tabId);
      }
      fillerMusic.stop();
    }
  }
};

const run = () => {
  chrome.tabs.onUpdated.addListener(checkForAd);
};

run();
