const SPOTIFY_URL = "open.spotify.com/";
const SPOTIFY_AD_TITLE = "Advertisement ·";

const fillerMusic1 = new Audio("music/Astral.mp3");

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

const stop = (audio) => {
	audio.pause();
	audio.currentTime = 0;
};

const playFillerInNewTab = () => {
	chrome.tabs.create({ url: "https://www.google.com/", selected: false }, function (tab) {
		fillerMusic1.play();
		chrome.tabs.remove(tab.id);
	});
};

const checkForAd = (tabId, _changeInfo, tab) => {
	if (tab.url.match(SPOTIFY_URL)) {
		if (titleIsAd(tab.title)) {
			console.log("Ad detected");
			if (!tab.mutedInfo.muted) {
				mute(tabId);
				playFillerInNewTab();
			}
		} else {
			if (tab.mutedInfo.muted) {
				unmute(tabId);
			}
			stop(fillerMusic1);
		}
	}
};

const run = () => {
	chrome.tabs.onUpdated.addListener(checkForAd);
};

run();
