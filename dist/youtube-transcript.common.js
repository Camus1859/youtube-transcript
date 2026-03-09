'use strict';Object.defineProperty(exports,'__esModule',{value:true});/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}const RE_YOUTUBE = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';
const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
const RE_XML_TRANSCRIPT_ASR = /<p t="(\d+)" d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
const RE_XML_TRANSCRIPT_ASR_SEGMENT = /<s[^>]*>([^<]*)<\/s>/g;
class YoutubeTranscriptError extends Error {
    constructor(message) {
        super(`[YoutubeTranscript] 🚨 ${message}`);
    }
}
class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
    constructor() {
        super('YouTube is receiving too many requests from this IP and now requires solving a captcha to continue');
    }
}
class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
    constructor(videoId) {
        super(`The video is no longer available (${videoId})`);
    }
}
class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
    constructor(videoId) {
        super(`Transcript is disabled on this video (${videoId})`);
    }
}
class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
    constructor(videoId) {
        super(`No transcripts are available for this video (${videoId})`);
    }
}
class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
    constructor(lang, availableLangs, videoId) {
        super(`No transcripts are available in ${lang} this video (${videoId}). Available languages: ${availableLangs.join(', ')}`);
    }
}
class YoutubeTranscriptEmptyError extends YoutubeTranscriptError {
    constructor(videoId, method) {
        super(`The transcript file URL returns an empty response using ${method} (${videoId})`);
    }
}
/**
 * Class to retrieve transcript if exist
 */
class YoutubeTranscript {
    /**
     * Fetch transcript from YTB Video
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    static fetchTranscript(videoId, config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.fetchTranscriptWithHtmlScraping(videoId, config);
            }
            catch (e) {
                if (e instanceof YoutubeTranscriptEmptyError) {
                    return yield this.fetchTranscriptWithInnerTube(videoId, config);
                }
                else {
                    throw e;
                }
            }
        });
    }
    /**
     * Fetch transcript from YTB Video using HTML scraping
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    static fetchTranscriptWithHtmlScraping(videoId, config) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const identifier = this.retrieveVideoId(videoId);
            const videoPageResponse = yield fetch(`https://www.youtube.com/watch?v=${identifier}`, {
                headers: Object.assign(Object.assign({}, ((config === null || config === void 0 ? void 0 : config.lang) && { 'Accept-Language': config.lang })), { 'User-Agent': USER_AGENT }),
            });
            const videoPageBody = yield videoPageResponse.text();
            const splittedHTML = videoPageBody.split('"captions":');
            if (splittedHTML.length <= 1) {
                if (videoPageBody.includes('class="g-recaptcha"')) {
                    throw new YoutubeTranscriptTooManyRequestError();
                }
                if (!videoPageBody.includes('"playabilityStatus":')) {
                    throw new YoutubeTranscriptVideoUnavailableError(videoId);
                }
                throw new YoutubeTranscriptDisabledError(videoId);
            }
            const captions = (_a = (() => {
                try {
                    return JSON.parse(splittedHTML[1].split(',"videoDetails')[0].replace('\n', ''));
                }
                catch (e) {
                    return undefined;
                }
            })()) === null || _a === void 0 ? void 0 : _a['playerCaptionsTracklistRenderer'];
            const processedTranscript = yield this.processTranscriptFromCaptions(captions, videoId, config);
            if (!processedTranscript.length) {
                throw new YoutubeTranscriptEmptyError(videoId, 'HTML scraping');
            }
            return processedTranscript;
        });
    }
    /**
     * Fetch transcript from YTB Video using InnerTube API
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    static fetchTranscriptWithInnerTube(videoId, config) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const identifier = this.retrieveVideoId(videoId);
            const options = {
                method: 'POST',
                headers: Object.assign(Object.assign({}, ((config === null || config === void 0 ? void 0 : config.lang) && { 'Accept-Language': config.lang })), { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; Android 13)' }),
                body: JSON.stringify({
                    context: {
                        client: {
                            clientName: 'ANDROID',
                            clientVersion: '19.09.37',
                            androidSdkVersion: 33,
                            hl: (_a = config === null || config === void 0 ? void 0 : config.lang) !== null && _a !== void 0 ? _a : 'en',
                            gl: 'US',
                        },
                    },
                    videoId: identifier,
                }),
            };
            const InnerTubeApiResponse = yield fetch('https://www.youtube.com/youtubei/v1/player', options);
            const responseJson = yield InnerTubeApiResponse.json();
            const captions = (_b = responseJson === null || responseJson === void 0 ? void 0 : responseJson.captions) === null || _b === void 0 ? void 0 : _b.playerCaptionsTracklistRenderer;
            if (!captions) {
                throw new YoutubeTranscriptDisabledError(identifier);
            }
            const processedTranscript = yield this.processTranscriptFromCaptions(captions, videoId, config);
            if (!processedTranscript.length) {
                throw new YoutubeTranscriptEmptyError(videoId, 'InnerTube API');
            }
            return processedTranscript;
        });
    }
    static decodeHTMLEntities(text) {
        var _a;
        if (!text)
            return '';
        if (typeof window !== 'undefined' &&
            typeof window.document !== 'undefined') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            return (_a = doc.documentElement.textContent) !== null && _a !== void 0 ? _a : '';
        }
        if (typeof globalThis !== 'undefined') {
            return text
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&#39;/g, "'")
                .replace(/&#x27;/g, "'");
        }
        return text;
    }
    /**
     * Process transcript from data captions
     * @param captions Data captions
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO
     */
    static processTranscriptFromCaptions(captions, videoId, config) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!captions) {
                throw new YoutubeTranscriptDisabledError(videoId);
            }
            if (!('captionTracks' in captions)) {
                throw new YoutubeTranscriptNotAvailableError(videoId);
            }
            if ((config === null || config === void 0 ? void 0 : config.lang) &&
                !captions.captionTracks.some((track) => track.languageCode === (config === null || config === void 0 ? void 0 : config.lang))) {
                throw new YoutubeTranscriptNotAvailableLanguageError(config === null || config === void 0 ? void 0 : config.lang, captions.captionTracks.map((track) => track.languageCode), videoId);
            }
            const transcriptURL = ((config === null || config === void 0 ? void 0 : config.lang) ? captions.captionTracks.find((track) => track.languageCode === (config === null || config === void 0 ? void 0 : config.lang) ||
                track.languageCode.startsWith(config.lang + '-'))
                : captions.captionTracks.find((t) => t.kind === 'asr') ||
                    captions.captionTracks[0]).baseUrl;
            const transcriptResponse = yield fetch(transcriptURL, {
                headers: Object.assign(Object.assign({}, ((config === null || config === void 0 ? void 0 : config.lang) && { 'Accept-Language': config.lang })), { 'User-Agent': USER_AGENT }),
            });
            if (!transcriptResponse.ok) {
                throw new YoutubeTranscriptNotAvailableError(videoId);
            }
            const transcriptBody = yield transcriptResponse.text();
            const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
            if (results.length) {
                return results
                    .map((result) => {
                    var _a;
                    return ({
                        text: result[3],
                        duration: parseFloat(result[2]),
                        offset: parseFloat(result[1]),
                        lang: (_a = config === null || config === void 0 ? void 0 : config.lang) !== null && _a !== void 0 ? _a : captions.captionTracks[0].languageCode,
                    });
                })
                    .filter((item) => item.text.trim() !== '');
            }
            const asrResults = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT_ASR)];
            return asrResults
                .map((block) => {
                var _a;
                let text;
                const matchAllASRSegment = [
                    ...block[3].matchAll(RE_XML_TRANSCRIPT_ASR_SEGMENT),
                ];
                if (matchAllASRSegment.length) {
                    text = matchAllASRSegment
                        .map((s) => s[1])
                        .join('')
                        .trim();
                }
                else {
                    text = block[3].replace(/<[^>]*>/g, '').trim();
                }
                if (!text || text.trim() === '')
                    return null;
                return {
                    text: this.decodeHTMLEntities(text),
                    duration: Number(block[2]) / 1000,
                    offset: Number(block[1]) / 1000,
                    lang: (_a = config === null || config === void 0 ? void 0 : config.lang) !== null && _a !== void 0 ? _a : captions.captionTracks[0].languageCode,
                };
            })
                .filter(Boolean);
        });
    }
    /**
     * Retrieve video id from url or string
     * @param videoId video url or video id
     */
    static retrieveVideoId(videoId) {
        if (videoId.length === 11) {
            return videoId;
        }
        const matchId = videoId.match(RE_YOUTUBE);
        if (matchId && matchId.length) {
            return matchId[1];
        }
        throw new YoutubeTranscriptError('Impossible to retrieve Youtube video ID.');
    }
}exports.YoutubeTranscript=YoutubeTranscript;exports.YoutubeTranscriptDisabledError=YoutubeTranscriptDisabledError;exports.YoutubeTranscriptEmptyError=YoutubeTranscriptEmptyError;exports.YoutubeTranscriptError=YoutubeTranscriptError;exports.YoutubeTranscriptNotAvailableError=YoutubeTranscriptNotAvailableError;exports.YoutubeTranscriptNotAvailableLanguageError=YoutubeTranscriptNotAvailableLanguageError;exports.YoutubeTranscriptTooManyRequestError=YoutubeTranscriptTooManyRequestError;exports.YoutubeTranscriptVideoUnavailableError=YoutubeTranscriptVideoUnavailableError;