export default {
  icon: "https://twitter.com/favicon.ico",
  name: {
    en: "Twitter X - Add download button",
    vi: "Twitter X - Thêm nút tải video/ảnh",
  },
  description: {
    en: "Add the download button to all video and photo in Twitter",
    vi: "Thêm nút tải cho mọi video/ảnh trên Twitter",
    img: "/scripts/twitter_downloadButton.png",
  },
  infoLink: "https://greasyfork.org/en/scripts/423001-twitter-media-downloader",

  whiteList: ["https://mobile.twitter.com/*", "https://twitter.com/*"],

  pageScript: {
    // prettier-ignore
    onDocumentIdle: async () => {
      // ==UserScript==
      // @name        Twitter Media Downloader
      // @name:ja     Twitter Media Downloader
      // @name:zh-cn  Twitter 媒体下载
      // @name:zh-tw  Twitter 媒體下載
      // @description    Save Video/Photo by One-Click.
      // @description:ja ワンクリックで動画・画像を保存する。
      // @description:zh-cn 一键保存视频/图片
      // @description:zh-tw 一鍵保存視頻/圖片
      // @version     1.27
      // @author      AMANE
      // @namespace   none
      // @match       https://twitter.com/*
      // @match       https://mobile.twitter.com/*
      // @grant       GM_registerMenuCommand
      // @grant       GM_setValue
      // @grant       GM_getValue
      // @grant       GM_download
      // @compatible  Chrome
      // @compatible  Firefox
      // @license     MIT
      // ==/UserScript==
      /* jshint esversion: 8 */

      const filename = 'twitter_{user-name}(@{user-id})_{date-time}_{status-id}_{file-type}';

      const TMD = (function () {
        let lang, host, history, show_sensitive, is_tweetdeck;
        return {
          init: async function () {
            // GM_registerMenuCommand((this.language[navigator.language] || this.language.en).settings, this.settings);
            lang = this.language[document.querySelector('html').lang] || this.language.en;
            host = location.hostname;
            is_tweetdeck = host.indexOf('tweetdeck') >= 0;
            history = this.storage_obsolete();
            if (history.length) {
              this.storage(history);
              this.storage_obsolete(true);
            } else history = await this.storage();
            // show_sensitive = GM_getValue('show_sensitive', false);
            (document.head||document.documentElement).insertAdjacentHTML('beforeend', '<style>' + this.css + (show_sensitive ? this.css_ss : '') + '</style>');
            let observer = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(node => this.detect(node))));
            observer.observe(document.body, {childList: true, subtree: true});
          },
          detect: function(node) {
            let article = node.tagName == 'ARTICLE' && node || node.tagName == 'DIV' && (node.querySelector('article') || node.closest('article'));
            if (article) this.addButtonTo(article);
            let listitems = node.tagName == 'LI' && node.getAttribute('role') == 'listitem' && [node] || node.tagName == 'DIV' && node.querySelectorAll('li[role="listitem"]');
            if (listitems) this.addButtonToMedia(listitems);
          },
          addButtonTo: function (article) {
            if (article.dataset.detected) return;
            article.dataset.detected = 'true';
            let media_selector = [
              'a[href*="/photo/1"]',
              'div[role="progressbar"]',
              'div[data-testid="playButton"]',
              'a[href="/settings/content_you_see"]', //hidden content
              'div.media-image-container', // for tweetdeck
              'div.media-preview-container', // for tweetdeck
              'div[aria-labelledby]>div:first-child>div[role="button"][tabindex="0"]' //for audio (experimental)
            ];
            let media = article.querySelector(media_selector.join(','));
            if (media) {
              let status_id = article.querySelector('a[href*="/status/"]').href.split('/status/').pop().split('/').shift();
              let btn_group = article.querySelector('div[role="group"]:last-of-type, ul.tweet-actions, ul.tweet-detail-actions');
              let btn_share = Array.from(btn_group.querySelectorAll(':scope>div>div, li.tweet-action-item>a, li.tweet-detail-action-item>a')).pop().parentNode;
              let btn_down = btn_share.cloneNode(true);
              if (is_tweetdeck) {
                btn_down.firstElementChild.innerHTML = '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px;">' + this.svg + '</svg>';
                btn_down.firstElementChild.removeAttribute('rel');
                btn_down.classList.replace("pull-left", "pull-right");
              } else {
                btn_down.querySelector('svg').innerHTML = this.svg;
              }
              let is_exist = history.indexOf(status_id) >= 0;
              this.status(btn_down, 'tmd-down');
              this.status(btn_down, is_exist ? 'completed' : 'download', is_exist ? lang.completed : lang.download);
              btn_group.insertBefore(btn_down, btn_share.nextSibling);
              btn_down.onclick = () => this.click(btn_down, status_id, is_exist);
              if (show_sensitive) {
                let btn_show = article.querySelector('div[aria-labelledby] div[role="button"][tabindex="0"]:not([data-testid]) > div[dir] > span > span');
                if (btn_show) btn_show.click();
              }
            }
            let imgs = article.querySelectorAll('a[href*="/photo/"]');
            if (imgs.length > 1) {
              let status_id = article.querySelector('a[href*="/status/"]').href.split('/status/').pop().split('/').shift();
              let btn_group = article.querySelector('div[role="group"]:last-of-type');
              let btn_share = Array.from(btn_group.querySelectorAll(':scope>div>div')).pop().parentNode;
              imgs.forEach(img => {
                let index = img.href.split('/status/').pop().split('/').pop();
                let is_exist = history.indexOf(status_id) >= 0;
                let btn_down = document.createElement('div');
                btn_down.innerHTML = '<div><div><svg viewBox="0 0 24 24" style="width: 18px; height: 18px;">' + this.svg + '</svg></div></div>';
                btn_down.classList.add('tmd-down', 'tmd-img');
                this.status(btn_down, 'download');
                img.parentNode.appendChild(btn_down);
                btn_down.onclick = e => {
                  e.preventDefault();
                  this.click(btn_down, status_id, is_exist, index);
                }
              });
            }
          },
          addButtonToMedia: function(listitems) {
            listitems.forEach(li => {
              if (li.dataset.detected) return;
              li.dataset.detected = 'true';
              let status_id = li.querySelector('a[href*="/status/"]').href.split('/status/').pop().split('/').shift();
              let is_exist = history.indexOf(status_id) >= 0;
              let btn_down = document.createElement('div');
              btn_down.innerHTML = '<div><div><svg viewBox="0 0 24 24" style="width: 18px; height: 18px;">' + this.svg + '</svg></div></div>';
              btn_down.classList.add('tmd-down', 'tmd-media');
              this.status(btn_down, is_exist ? 'completed' : 'download', is_exist ? lang.completed : lang.download);
              li.appendChild(btn_down);
              btn_down.onclick = () => this.click(btn_down, status_id, is_exist);
            });
          },
          click: async function (btn, status_id, is_exist, index) {
            if (btn.classList.contains('loading')) return;
            this.status(btn, 'loading');
            // let out = (await GM_getValue('filename', filename)).split('\n').join('');
            let out = filename.split('\n').join('');
            // let save_history = await GM_getValue('save_history', true);
            let save_history = true
            let json = await this.fetchJson(status_id);
            console.log(json)
            let tweet = json.legacy;
            let user = json.core.user_results.result.legacy;
            let invalid_chars = {'\\': '＼', '\/': '／', '\|': '｜', '<': '＜', '>': '＞', ':': '：', '*': '＊', '?': '？', '"': '＂', '\u200b': '', '\u200c': '', '\u200d': '', '\u2060': '', '\ufeff': '', '🔞': ''};
            let datetime = out.match(/{date-time(-local)?:[^{}]+}/) ? out.match(/{date-time(?:-local)?:([^{}]+)}/)[1].replace(/[\\/|<>*?:"]/g, v => invalid_chars[v]) : 'YYYYMMDD-hhmmss';
            let info = {};
            info['status-id'] = status_id;
            info['user-name'] = user.name.replace(/([\\/|*?:"]|[\u200b-\u200d\u2060\ufeff]|🔞)/g, v => invalid_chars[v]);
            info['user-id'] = user.screen_name;
            info['date-time'] = this.formatDate(tweet.created_at, datetime);
            info['date-time-local'] = this.formatDate(tweet.created_at, datetime, true);
            info['full-text'] = tweet.full_text.split('\n').join(' ').replace(/\s*https:\/\/t\.co\/\w+/g, '').replace(/[\\/|<>*?:"]|[\u200b-\u200d\u2060\ufeff]/g, v => invalid_chars[v]);
            let medias = tweet.extended_entities && tweet.extended_entities.media;
            if (index) medias = [medias[index - 1]];
            if (medias?.length > 0) {
              let tasks = medias.length;
              let tasks_result = [];
              medias.forEach((media, i) => {
                info.url = media.type == 'photo' ? media.media_url_https + ':orig' : media.video_info.variants.filter(n => n.content_type == 'video/mp4').sort((a, b) => b.bitrate - a.bitrate)[0].url;
                info.file = info.url.split('/').pop().split(/[:?]/).shift();
                info['file-name'] = info.file.split('.').shift();
                info['file-ext'] = info.file.split('.').pop();
                info['file-type'] = media.type.replace('animated_', '');
                info.out = (out.replace(/\.?{file-ext}/, '') + ((medias.length > 1 || index) && !out.match('{file-name}') ? '-' + (index ? index - 1 : i) : '') + '.{file-ext}').replace(/{([^{}:]+)(:[^{}]+)?}/g, (match, name) => info[name]);
                this.downloader.add({
                  url: info.url,
                  name: info.out,
                  onload: () => {
                    tasks -= 1;
                    tasks_result.push(((medias.length > 1 || index) ? (index ? index : i + 1) + ': ' : '') + lang.completed);
                    this.status(btn, null, tasks_result.sort().join('\n'));
                    if (tasks === 0) {
                      this.status(btn, 'completed', lang.completed);
                      if (save_history && !is_exist) {
                        history.push(status_id);
                        this.storage(status_id);
                      }
                    }
                  },
                  onerror: result => {
                    tasks = -1;
                    tasks_result.push((medias.length > 1 ? i + 1 + ': ' : '') + result.details.current);
                    this.status(btn, 'failed', tasks_result.sort().join('\n'));
                  }
                });
              });
            } else {
              this.status(btn, 'failed', 'MEDIA_NOT_FOUND');
            }
          },
          status: function (btn, css, title, style) {
            if (css) {
              btn.classList.remove('download', 'completed', 'loading', 'failed');
              btn.classList.add(css);
            }
            if (title) btn.title = title;
            if (style) btn.style.cssText = style;
          },
          fetchJson: async function (status_id) {
            let base_url = `https://${host}/i/api/graphql/NmCeCgkVlsRGS1cAwqtgmw/TweetDetail`;
            let variables = {
              "focalTweetId":status_id,
              "with_rux_injections":false,
              "includePromotedContent":true,
              "withCommunity":true,
              "withQuickPromoteEligibilityTweetFields":true,
              "withBirdwatchNotes":true,
              "withVoice":true,
              "withV2Timeline":true
            };
            let features = {
              "rweb_lists_timeline_redesign_enabled":true,
              "responsive_web_graphql_exclude_directive_enabled":true,
              "verified_phone_label_enabled":false,
              "creator_subscriptions_tweet_preview_api_enabled":true,
              "responsive_web_graphql_timeline_navigation_enabled":true,
              "responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,
              "tweetypie_unmention_optimization_enabled":true,
              "responsive_web_edit_tweet_api_enabled":true,
              "graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,
              "view_counts_everywhere_api_enabled":true,
              "longform_notetweets_consumption_enabled":true,
              "responsive_web_twitter_article_tweet_consumption_enabled":false,
              "tweet_awards_web_tipping_enabled":false,
              "freedom_of_speech_not_reach_fetch_enabled":true,
              "standardized_nudges_misinfo":true,
              "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,
              "longform_notetweets_rich_text_read_enabled":true,
              "longform_notetweets_inline_media_enabled":true,
              "responsive_web_media_download_video_enabled":false,
              "responsive_web_enhance_cards_enabled":false
            };
            let url = encodeURI(`${base_url}?variables=${JSON.stringify(variables)}&features=${JSON.stringify(features)}`);
            let cookies = this.getCookie();
            let headers = {
              'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
              'x-twitter-active-user': 'yes',
              'x-twitter-client-language': cookies.lang,
              'x-csrf-token': cookies.ct0
            };
            if (cookies.ct0.length == 32) headers['x-guest-token'] = cookies.gt;
            let tweet_detail = await fetch(url, {headers: headers}).then(result => result.json());
            let tweet_entrie = tweet_detail.data.threaded_conversation_with_injections_v2.instructions[0].entries.find(n => n.entryId == `tweet-${status_id}`);
            let tweet_result = tweet_entrie.content.itemContent.tweet_results.result;
            return tweet_result.tweet || tweet_result;
          },
          getCookie: function (name) {
            let cookies = {};
            document.cookie.split(';').filter(n => n.indexOf('=') > 0).forEach(n => {
              n.replace(/^([^=]+)=(.+)$/, (match, name, value) => {
                cookies[name.trim()] = value.trim();
              });
            });
            return name ? cookies[name] : cookies;
          },
          storage: async function (value) {
            let data = JSON.parse(localStorage.getItem('ufs-twitter-download_history') || '[]');
            let data_length = data.length;
            if (value) {
              if (Array.isArray(value)) data = data.concat(value);
              else if (data.indexOf(value) < 0) data.push(value);
            } else return data;
            if (data.length > data_length)
              localStorage.setItem('ufs-twitter-download_history', JSON.stringify(data));
          },
          storage_obsolete: function (is_remove) {
            let data = JSON.parse(localStorage.getItem('history') || '[]');
            if (is_remove) localStorage.removeItem('history');
            else return data;
          },
          formatDate: function (i, o, tz) {
            let d = new Date(i);
            if (tz) d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            let m = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
            let v = {
              YYYY: d.getUTCFullYear().toString(),
              YY: d.getUTCFullYear().toString(),
              MM: d.getUTCMonth() + 1,
              MMM: m[d.getUTCMonth()],
              DD: d.getUTCDate(),
              hh: d.getUTCHours(),
              mm: d.getUTCMinutes(),
              ss: d.getUTCSeconds(),
              h2: d.getUTCHours() % 12,
              ap: d.getUTCHours() < 12 ? 'AM' : 'PM'
            };
            return o.replace(/(YY(YY)?|MMM?|DD|hh|mm|ss|h2|ap)/g, n => ('0' + v[n]).substr(-n.length));
          },
          downloader: (function () {
            let tasks = [], thread = 0, max_thread = 2, retry = 0, max_retry = 2, failed = 0, notifier, has_failed = false;
            return {
              add: function (task) {
                tasks.push(task);
                if (thread < max_thread) {
                  thread += 1;
                  this.next();
                } else this.update();
              },
              next: async function () {
                let task = tasks.shift();
                await this.start(task);
                if (tasks.length > 0 && thread <= max_thread) this.next();
                else thread -= 1;
                this.update();
              },
              start: function (task) {
                this.update();
                return new Promise(resolve => {
                  UfsGlobal.Utils.downloadBlobUrl(task.url, task.name)
                    .then(() => {
                      task.onload();
                      resolve();
                    })
                    .catch(e => {
                      this.retry(task, e);
                      resolve();
                    })
                });
              },
              retry: function (task, result) {
                retry += 1;
                if (retry == 3) max_thread = 1;
                if (task.retry && task.retry >= max_retry ||
                    result.details && result.details.current == 'USER_CANCELED') {
                  task.onerror(result);
                  failed += 1;
                } else {
                  if (max_thread == 1) task.retry = (task.retry || 0) + 1;
                  this.add(task);
                }
              },
              update: function() {
                if (!notifier) {
                  notifier = document.createElement('div');
                  notifier.title = 'Twitter Media Downloader';
                  notifier.classList.add('tmd-notifier');
                  notifier.innerHTML = '<label>0</label>|<label>0</label>';
                  document.body.appendChild(notifier);
                }
                if (failed > 0 && !has_failed) {
                  has_failed = true;
                  notifier.innerHTML += '|';
                  let clear = document.createElement('label');
                  notifier.appendChild(clear);
                  clear.onclick = () => {
                    notifier.innerHTML = '<label>0</label>|<label>0</label>';
                    failed = 0;
                    has_failed = false;
                    this.update();
                  };
                }
                notifier.firstChild.innerText = thread;
                notifier.firstChild.nextElementSibling.innerText = tasks.length;
                if (failed > 0) notifier.lastChild.innerText = failed;
                if (thread > 0 || tasks.length > 0 || failed > 0) notifier.classList.add('running');
                else notifier.classList.remove('running');
              }
            };
          })(),
          language: {
            en: {download: 'Download', completed: 'Download Completed', settings: 'Settings', dialog: {title: 'Download Settings', save: 'Save', save_history: 'Remember download history', clear_history: '(Clear)', clear_confirm: 'Clear download history?', show_sensitive: 'Always show sensitive content', pattern: 'File Name Pattern'}},
            ja: {download: 'ダウンロード', completed: 'ダウンロード完了', settings: '設定', dialog: {title: 'ダウンロード設定', save: '保存', save_history: 'ダウンロード履歴を保存する', clear_history: '(クリア)', clear_confirm: 'ダウンロード履歴を削除する？', show_sensitive: 'センシティブな内容を常に表示する', pattern: 'ファイル名パターン'}},
            zh: {download: '下载', completed: '下载完成', settings: '设置', dialog: {title: '下载设置', save: '保存', save_history: '保存下载记录', clear_history: '(清除)', clear_confirm: '确认要清除下载记录？', show_sensitive: '自动显示敏感的内容', pattern: '文件名格式'}},
            'zh-Hant': {download: '下載', completed: '下載完成', settings: '設置', dialog: {title: '下載設置', save: '保存', save_history: '保存下載記錄', clear_history: '(清除)', clear_confirm: '確認要清除下載記錄？', show_sensitive: '自動顯示敏感的内容', pattern: '文件名規則'}}
          },
          css: `
      .tmd-down {margin-left: 12px; order: 99;}
      .tmd-down:hover > div > div > div > div {color: rgba(29, 161, 242, 1.0);}
      .tmd-down:hover > div > div > div > div > div {background-color: rgba(29, 161, 242, 0.1);}
      .tmd-down:active > div > div > div > div > div {background-color: rgba(29, 161, 242, 0.2);}
      .tmd-down:hover svg {color: rgba(29, 161, 242, 1.0);}
      .tmd-down:hover div:first-child:not(:last-child) {background-color: rgba(29, 161, 242, 0.1);}
      .tmd-down:active div:first-child:not(:last-child) {background-color: rgba(29, 161, 242, 0.2);}
      .tmd-down.tmd-media {position: absolute; right: 0;}
      .tmd-down.tmd-media > div {display: flex; border-radius: 99px; margin: 2px;}
      .tmd-down.tmd-media > div > div {display: flex; margin: 6px; color: #fff;}
      .tmd-down.tmd-media:hover > div {background-color: rgba(255,255,255, 0.6);}
      .tmd-down.tmd-media:hover > div > div {color: rgba(29, 161, 242, 1.0);}
      .tmd-down.tmd-media:not(:hover) > div > div {filter: drop-shadow(0 0 1px #000);}
      .tmd-down g {display: none;}
      .tmd-down.download g.download, .tmd-down.completed g.completed, .tmd-down.loading g.loading,.tmd-down.failed g.failed {display: unset;}
      .tmd-down.loading svg {animation: spin 1s linear infinite;}
      @keyframes spin {0% {transform: rotate(0deg);} 100% {transform: rotate(360deg);}}
      .tmd-btn {display: inline-block; background-color: #1DA1F2; color: #FFFFFF; padding: 0 20px; border-radius: 99px;}
      .tmd-tag {display: inline-block; background-color: #FFFFFF; color: #1DA1F2; padding: 0 10px; border-radius: 10px; border: 1px solid #1DA1F2;  font-weight: bold; margin: 5px;}
      .tmd-btn:hover {background-color: rgba(29, 161, 242, 0.9);}
      .tmd-tag:hover {background-color: rgba(29, 161, 242, 0.1);}
      .tmd-notifier {display: none; position: fixed; left: 16px; bottom: 16px; color: #000; background: #fff; border: 1px solid #ccc; border-radius: 8px; padding: 4px;}
      .tmd-notifier.running {display: flex; align-items: center;}
      .tmd-notifier label {display: inline-flex; align-items: center; margin: 0 8px;}
      .tmd-notifier label:before {content: " "; width: 32px; height: 16px; background-position: center; background-repeat: no-repeat;}
      .tmd-notifier label:nth-child(1):before {background-image:url("data:image/svg+xml;charset=utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22><path d=%22M3,14 v5 q0,2 2,2 h14 q2,0 2,-2 v-5 M7,10 l4,4 q1,1 2,0 l4,-4 M12,3 v11%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 /></svg>");}
      .tmd-notifier label:nth-child(2):before {background-image:url("data:image/svg+xml;charset=utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22><path d=%22M12,2 a1,1 0 0 1 0,20 a1,1 0 0 1 0,-20 M12,5 v7 h6%22 fill=%22none%22 stroke=%22%23999%22 stroke-width=%222%22 stroke-linejoin=%22round%22 stroke-linecap=%22round%22 /></svg>");}
      .tmd-notifier label:nth-child(3):before {background-image:url("data:image/svg+xml;charset=utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22><path d=%22M12,0 a2,2 0 0 0 0,24 a2,2 0 0 0 0,-24%22 fill=%22%23f66%22 stroke=%22none%22 /><path d=%22M14.5,5 a1,1 0 0 0 -5,0 l0.5,9 a1,1 0 0 0 4,0 z M12,17 a2,2 0 0 0 0,5 a2,2 0 0 0 0,-5%22 fill=%22%23fff%22 stroke=%22none%22 /></svg>");}
      .tmd-down.tmd-img {position: absolute; right: 0; bottom: 0; display: none !important;}
      .tmd-down.tmd-img > div {display: flex; border-radius: 99px; margin: 2px; background-color: rgba(255,255,255, 0.6);}
      .tmd-down.tmd-img > div > div {display: flex; margin: 6px; color: #fff !important;}
      .tmd-down.tmd-img:not(:hover) > div > div {filter: drop-shadow(0 0 1px #000);}
      .tmd-down.tmd-img:hover > div > div {color: rgba(29, 161, 242, 1.0);}
      :hover > .tmd-down.tmd-img, .tmd-img.loading, .tmd-img.completed, .tmd-img.failed {display: block !important;}
      .tweet-detail-action-item {width: 20% !important;}
      `,
          css_ss: `
      /* show sensitive in media tab */
      li[role="listitem"]>div>div>div>div:not(:last-child) {filter: none;}
      li[role="listitem"]>div>div>div>div+div:last-child {display: none;}
      `,
          svg: `
      <g class="download"><path d="M3,14 v5 q0,2 2,2 h14 q2,0 2,-2 v-5 M7,10 l4,4 q1,1 2,0 l4,-4 M12,3 v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></g>
      <g class="completed"><path d="M3,14 v5 q0,2 2,2 h14 q2,0 2,-2 v-5 M7,10 l3,4 q1,1 2,0 l8,-11" fill="none" stroke="#1DA1F2" stroke-width="2" stroke-linecap="round" /></g>
      <g class="loading"><circle cx="12" cy="12" r="10" fill="none" stroke="#1DA1F2" stroke-width="4" opacity="0.4" /><path d="M12,2 a10,10 0 0 1 10,10" fill="none" stroke="#1DA1F2" stroke-width="4" stroke-linecap="round" /></g>
      <g class="failed"><circle cx="12" cy="12" r="11" fill="#f33" stroke="currentColor" stroke-width="2" opacity="0.8" /><path d="M14,5 a1,1 0 0 0 -4,0 l0.5,9.5 a1.5,1.5 0 0 0 3,0 z M12,17 a2,2 0 0 0 0,4 a2,2 0 0 0 0,-4" fill="#fff" stroke="none" /></g>
      `
        };
      })();

      TMD.init();
    },
  },
};
