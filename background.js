const SPOTIFY_URL = "open.spotify.com/";
const SPOTIFY_AD_TITLE_START = "Spotify –";

const random = (arr) => {
  return arr[Math.floor(Math.random() * arr.length)];
};

let offscreenDocumentReady = false;

class MusicPlayer {
  constructor() {
    this.currentlyPlaying = false;
  }

  audioUrls = [
    "music/ThinkingFree.mp3",
    "music/RockHopping.mp3",
    "music/Cheeky.mp3",
    "music/HereForYears.mp3",
    "music/lofi-study.mp3",
  ];

  async ensureOffscreenDocumentCreated() {
    if (offscreenDocumentReady) return;

    // check if offscreen document exists
    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
      });

      if (existingContexts.length === 0) {
        // create an offscreen document if it doesn't exist
        await chrome.offscreen.createDocument({
          url: "offscreen.html",
          reasons: ["AUDIO_PLAYBACK"],
          justification: "Playing filler music in place of jarring noise",
        });
      }
    } catch (e) {
      console.error("Error creating offscreen document:", e);
    }
  }

  async playRandom() {
    await this.ensureOffscreenDocumentCreated();
    const audioPath = chrome.runtime.getURL(random(this.audioUrls));

    try {
      await chrome.runtime.sendMessage({
        action: "play",
        audioPath,
      });
      this.currentlyPlaying = true;
    } catch (e) {
      console.error("Error playing audio:", e);
    }
  }

  async stop() {
    if (this.currentlyPlaying) {
      try {
        await chrome.runtime.sendMessage({
          action: "stop",
        });
        this.currentlyPlaying = false;
      } catch (e) {
        console.error("Error stopping audio:", e);
      }
    }
  }
}

const fillerMusic = new MusicPlayer();

const titleIsAd = (title) => {
  const adRegex = new RegExp(`^${SPOTIFY_AD_TITLE_START}`);
  return !!title.match(adRegex);
};

const mute = (tabId) => {
  chrome.tabs.update(tabId, { muted: true });
};

const unmute = (tabId) => {
  chrome.tabs.update(tabId, { muted: false });
};

const checkForAd = (tabId, _changeInfo, tab) => {
  if (tab.url && tab.url.includes(SPOTIFY_URL)) {
    if (titleIsAd(tab.title)) {
      if (!tab.mutedInfo.muted) {
        mute(tabId);
        fillerMusic.playRandom();
      }
    } else {
      if (tab.mutedInfo.muted) {
        unmute(tabId);
      }
      fillerMusic.stop();
    }
  }
};

// listen for messages from the offscreen document
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "offscreenReady") {
    offscreenDocumentReady = true;
  }
});

chrome.tabs.onUpdated.addListener(checkForAd);
