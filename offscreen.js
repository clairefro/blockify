let audio = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "play") {
    stopAudio();
    playAudio(message.audioPath);
    sendResponse({ success: true });
  } else if (message.action === "stop") {
    stopAudio();
    sendResponse({ success: true });
  }
  return true; // keep  message channel open for sendResponse
});

function playAudio(audioPath) {
  audio = new Audio(audioPath);
  audio.volume = 0.5;
  audio.play();
}

function stopAudio() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio = null;
  }
}

// let service worker know this document is ready
chrome.runtime.sendMessage({ action: "offscreenReady" });
