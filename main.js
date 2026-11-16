/* =================================================================
   HANKO — preview build / main.js
   1) i18n 切り替え
   2) ローマ字 → カタカナ／漢字（当て字はデモの簡易変換）
   3) 印影プレビューの canvas 描画（朱文）
   4) 軽量な reveal
   ================================================================= */
(function () {
  'use strict';

  /* オープニング（プリローダー）は削除しました。
     Higgsfield で素材を作ってから作り直す方針です。詳細は README を参照。 */

  /* ---------------- 1. i18n ---------------- */
  var LANGS = ['en', 'ja'];
  var lang = (function () {
    var saved = null;
    try { saved = localStorage.getItem('hanko.lang'); } catch (e) {}
    if (LANGS.indexOf(saved) >= 0) return saved;
    // 決定事項：デフォルトは英語
    return (navigator.language || '').toLowerCase().indexOf('ja') === 0 ? 'ja' : 'en';
  })();

  function applyLang(next) {
    lang = next;
    var d = window.DICT[next];
    document.documentElement.lang = next;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = d[el.getAttribute('data-i18n')];
      if (v == null) return;
      if (/<br\s*\/?>/i.test(v)) el.innerHTML = v; else el.textContent = v;
      el.__spOriginal = null; // data-split のキャッシュを無効化。次の rebuildSplits で新しい言語のテキストから組み直す
    });
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.lang === next);
    });
    try { localStorage.setItem('hanko.lang', next); } catch (e) {}
    document.title = next === 'ja' ? '印 — 名前を刻む、想いを贈る。' : 'HANKO — Seal of the Name';

    // 行の折れ位置が変わるので組み直し、カルーセルの説明も差し替える
    if (window.__rebuildSplits) window.__rebuildSplits();
    if (window.__cfRefresh) window.__cfRefresh();
  }

  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', function () { applyLang(b.dataset.lang); });
  });
  applyLang(lang);

  /* ---------------- 2. ローマ字/英字 → カタカナ ----------------
     試作版。よくある名前は辞書で、それ以外は規則ベースで変換します。
     実運用では専門の変換エンジン、または人手校正を挟む前提です。
  ------------------------------------------------------------ */
  var EXCEPTIONS = {
    angelica: 'アンジェリカ', marco: 'マルコ', sophie: 'ソフィー', chen: 'チェン',
    michael: 'マイケル', john: 'ジョン', james: 'ジェームス', david: 'デイビッド',
    emma: 'エマ', olivia: 'オリビア', sarah: 'サラ', anna: 'アンナ',
    thomas: 'トーマス', george: 'ジョージ', charles: 'チャールズ', william: 'ウィリアム',
    lucas: 'ルーカス', mateo: 'マテオ', chloe: 'クロエ', jean: 'ジャン',
    pierre: 'ピエール', hans: 'ハンス', ivan: 'イワン', wei: 'ウェイ',
    kim: 'キム', park: 'パク', li: 'リー', wang: 'ワン', nguyen: 'グエン'
  };

  var KANA = {
    a:'ア', i:'イ', u:'ウ', e:'エ', o:'オ',
    ka:'カ', ki:'キ', ku:'ク', ke:'ケ', ko:'コ',
    ga:'ガ', gi:'ギ', gu:'グ', ge:'ゲ', go:'ゴ',
    sa:'サ', si:'シ', su:'ス', se:'セ', so:'ソ',
    za:'ザ', zi:'ジ', zu:'ズ', ze:'ゼ', zo:'ゾ',
    ta:'タ', ti:'ティ', tu:'トゥ', te:'テ', to:'ト',
    da:'ダ', di:'ディ', du:'ドゥ', de:'デ', do:'ド',
    na:'ナ', ni:'ニ', nu:'ヌ', ne:'ネ', no:'ノ',
    ha:'ハ', hi:'ヒ', hu:'フ', he:'ヘ', ho:'ホ',
    ba:'バ', bi:'ビ', bu:'ブ', be:'ベ', bo:'ボ',
    pa:'パ', pi:'ピ', pu:'プ', pe:'ペ', po:'ポ',
    ma:'マ', mi:'ミ', mu:'ム', me:'メ', mo:'モ',
    ya:'ヤ', yi:'イ', yu:'ユ', ye:'イェ', yo:'ヨ',
    ra:'ラ', ri:'リ', ru:'ル', re:'レ', ro:'ロ',
    wa:'ワ', wi:'ウィ', wu:'ウ', we:'ウェ', wo:'ウォ',
    fa:'ファ', fi:'フィ', fu:'フ', fe:'フェ', fo:'フォ',
    va:'ヴァ', vi:'ヴィ', vu:'ヴ', ve:'ヴェ', vo:'ヴォ',
    sha:'シャ', shi:'シ', shu:'シュ', she:'シェ', sho:'ショ',
    cha:'チャ', chi:'チ', chu:'チュ', che:'チェ', cho:'チョ',
    ja:'ジャ', ji:'ジ', ju:'ジュ', je:'ジェ', jo:'ジョ',
    tsa:'ツァ', tsi:'ツィ', tsu:'ツ', tse:'ツェ', tso:'ツォ',
    kya:'キャ', kyu:'キュ', kyo:'キョ',
    gya:'ギャ', gyu:'ギュ', gyo:'ギョ',
    nya:'ニャ', nyu:'ニュ', nyo:'ニョ',
    hya:'ヒャ', hyu:'ヒュ', hyo:'ヒョ',
    mya:'ミャ', myu:'ミュ', myo:'ミョ',
    rya:'リャ', ryu:'リュ', ryo:'リョ',
    bya:'ビャ', byu:'ビュ', byo:'ビョ',
    pya:'ピャ', pyu:'ピュ', pyo:'ピョ'
  };

  // 単独子音の既定母音（英語風の読みに寄せる）
  var LONE = {
    k:'ku', g:'gu', s:'su', z:'zu', t:'to', d:'do', n:'n',
    h:'fu', b:'bu', p:'pu', m:'mu', r:'ru', l:'ru',
    y:'i', w:'u', f:'fu', v:'vu', j:'ji', c:'ku', q:'ku', x:'kusu'
  };

  function normalize(s) {
    return s.toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/zh/g, 'j')
      .replace(/ph/g, 'f')
      .replace(/ck/g, 'k')
      .replace(/qu/g, 'kw')
      .replace(/x/g, 'ks')
      .replace(/th/g, 's')
      .replace(/wh/g, 'w')
      .replace(/gh/g, '')
      .replace(/c(?=[eiy])/g, 's')
      .replace(/c/g, 'k')
      .replace(/([bdfgjklmnprstvwz])\1/g, '$1')    // 重子音を1つに
      .replace(/l/g, 'r')
      .replace(/y$/, 'ii')
      .replace(/ee/g, 'ii')
      .replace(/oo/g, 'uu')
      .replace(/ou/g, 'au')
      .replace(/([bdfgjkmnprstvwz])e$/, '$1')      // 語末の silent e
      .replace(/h$/, '')                            // 語末の h は落とす
      .replace(/([bdfgjkmnprstvwz])er(?=$|[bdfgjkmnprstvwz])/g, '$1aa'); // -er → アー
  }

  // カ + a のように、直前のかなの母音が続く場合は長音にする
  function vowelOf(roma) { return roma.charAt(roma.length - 1); }

  function toKatakana(input) {
    var key = input.toLowerCase().replace(/[^a-z]/g, '');
    if (EXCEPTIONS[key]) return EXCEPTIONS[key];
    if (!key) return '';

    var s = normalize(key);
    var V = 'aiueo', out = '', i = 0;

    while (i < s.length) {
      var m3 = s.substr(i, 3), m2 = s.substr(i, 2), m1 = s.charAt(i);

      if (KANA[m3]) {
        out += KANA[m3]; i += 3;
        if (s.charAt(i) === vowelOf(m3)) { out += 'ー'; i += 1; }
        continue;
      }
      if (KANA[m2]) {
        out += KANA[m2]; i += 2;
        if (s.charAt(i) === vowelOf(m2)) { out += 'ー'; i += 1; }
        continue;
      }

      // 長音
      if (V.indexOf(m1) >= 0 && s.charAt(i + 1) === m1) { out += (KANA[m1] || '') + 'ー'; i += 2; continue; }
      if (KANA[m1]) { out += KANA[m1]; i += 1; continue; }

      // 子音 + 母音以外 → 促音 or 既定母音
      if (m1 === 'n') {
        out += (V.indexOf(s.charAt(i + 1)) >= 0 || s.charAt(i + 1) === 'y') ? '' : 'ン';
        if (out.slice(-1) !== 'ン') { out += KANA['n' + s.charAt(i + 1)] || 'ン'; i += 2; continue; }
        i += 1; continue;
      }
      var lone = LONE[m1];
      if (lone) {
        // 同じ子音が続く → 促音
        if (s.charAt(i + 1) === m1) { out += 'ッ'; i += 1; continue; }
        var pieces = lone, j = 0, buf = '';
        while (j < pieces.length) {
          var p2 = pieces.substr(j, 2);
          if (KANA[p2]) { buf += KANA[p2]; j += 2; }
          else { buf += KANA[pieces.charAt(j)] || ''; j += 1; }
        }
        out += buf;
        i += 1; continue;
      }
      i += 1;
    }
    return out || 'ー';
  }

  /* ---------------- 2b. 漢字（当て字）変換 ―― 雰囲気確認用のデモ ----------------
     一部の名前だけ、意味を選んで当てた漢字を用意。それ以外は頭文字ごとに
     漢字1字を機械的に当てて連結するだけの簡易フォールバック。
     実際の当て字は職人が意味・音・見た目のバランスを見て選ぶもので、
     ここでの自動生成とは別物（preview.noteKanji に注記あり）。
     篆書フォント（HOT-白舟篆書教漢）は教育漢字1,026字しか描けないため、
     KYOIKU にない字を含む当て字は使わず、頭文字の予備でもその字は飛ばす。
     （範囲外の字を含む当て字は、当て字の選び直しが済むまでの暫定措置として出ない） */
  var KYOIKU = '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話悪安暗医委意育員院飲運泳駅央横屋温化荷界開階寒感漢館岸起期客究急級宮球去橋業曲局銀区苦具君係軽血決研県庫湖向幸港号根祭皿仕死使始指歯詩次事持式実写者主守取酒受州拾終習集住重宿所暑助昭消商章勝乗植申身神真深進世整昔全相送想息速族他打対待代第題炭短談着注柱丁帳調追定庭笛鉄転都度投豆島湯登等動童農波配倍箱畑発反坂板皮悲美鼻筆氷表秒病品負部服福物平返勉放味命面問役薬由油有遊予羊洋葉陽様落流旅両緑礼列練路和愛案以衣位茨印英栄媛塩岡億加果貨課芽賀改械害街各覚潟完官管関観願岐希季旗器機議求泣給挙漁共協鏡競極熊訓軍郡群径景芸欠結建健験固功好香候康佐差菜最埼材崎昨札刷察参産散残氏司試児治滋辞鹿失借種周祝順初松笑唱焼照城縄臣信井成省清静席積折節説浅戦選然争倉巣束側続卒孫帯隊達単置仲沖兆低底的典伝徒努灯働特徳栃奈梨熱念敗梅博阪飯飛必票標不夫付府阜富副兵別辺変便包法望牧末満未民無約勇要養浴利陸良料量輪類令冷例連老労録圧囲移因永営衛易益液演応往桜可仮価河過快解格確額刊幹慣眼紀基寄規喜技義逆久旧救居許境均禁句型経潔件険検限現減故個護効厚耕航鉱構興講告混査再災妻採際在財罪殺雑酸賛士支史志枝師資飼示似識質舎謝授修述術準序招証象賞条状常情織職制性政勢精製税責績接設絶祖素総造像増則測属率損貸態団断築貯張停提程適統堂銅導得毒独任燃能破犯判版比肥非費備評貧布婦武復複仏粉編弁保墓報豊防貿暴脈務夢迷綿輸余容略留領歴胃異遺域宇映延沿恩我灰拡革閣割株干巻看簡危机揮貴疑吸供胸郷勤筋系敬警劇激穴券絹権憲源厳己呼誤后孝皇紅降鋼刻穀骨困砂座済裁策冊蚕至私姿視詞誌磁射捨尺若樹収宗就衆従縦縮熟純処署諸除承将傷障蒸針仁垂推寸盛聖誠舌宣専泉洗染銭善奏窓創装層操蔵臓存尊退宅担探誕段暖値宙忠著庁頂腸潮賃痛敵展討党糖届難乳認納脳派拝背肺俳班晩否批秘俵腹奮並陛閉片補暮宝訪亡忘棒枚幕密盟模訳郵優預幼欲翌乱卵覧裏律臨朗論';
  var KANJI_PRESETS = {
    michael: '舞蹴', david: '妥美土', emily: '恵美利', james: '慈夢主',
    sarah: '沙羅', john: '叙穏', alex: '亜烈久', maria: '真理愛',
    chris: '久理寿', lucas: '流光', emma: '永真', olivia: '織美安',
    william: '維利安', sophie: '蘇妃'
  };
  var KANJI_FALLBACK = {
    a: '愛', b: '武', c: '心', d: '道', e: '栄', f: '風', g: '剛', h: '光',
    i: '生', j: '慈', k: '賢', l: '力', m: '満', n: '仁', o: '央', p: '平',
    q: '究', r: '龍', s: '誠', t: '天', u: '優', v: '輝', w: '和', x: '翔',
    y: '勇', z: '禅'
  };
  function inKyoiku(str) {
    return str.split('').every(function (c) { return KYOIKU.indexOf(c) >= 0; });
  }
  function toKanji(input) {
    var key = input.toLowerCase().replace(/[^a-z]/g, '');
    if (!key) return '';
    if (KANJI_PRESETS[key] && inKyoiku(KANJI_PRESETS[key])) return KANJI_PRESETS[key];
    var out = '';
    for (var i = 0; i < key.length && out.length < 4; i++) {
      var c = KANJI_FALLBACK[key.charAt(i)];
      if (c && inKyoiku(c)) out += c;
    }
    return out;
  }

  /* ---------------- 3. 印影プレビュー（canvas） ----------------
     漢字＋篆書（HOT-白舟篆書教漢, Adobe Fonts kitId: cag7czv）のみ。
     試作 _sealfit_test.html の「C 枠にくっつける」方式：
     文字ごとに縦横比を変えて枠いっぱいに伸ばし、円に面した辺を印郭まで広げる。
     文字は歪ませず、枠からはみ出た角は印郭の線の中心で切って枠線に溶け込ませる。
     （カタカナ・明朝・文字バランスの選択は 0919 に廃止。旧版は main_0911.js） */
  var canvas = document.getElementById('sealCanvas');
  var PAPER = '#f2efe8';
  var RED = '#6C180F';
  var FONT = '"hot-tenshokk", sans-serif';
  var ANISO = 2;      // 1文字の縦横の伸縮の上限（倍）
  var REACH = 0.5;    // くっつき具合（0＝円に内接する枠まで／1＝辺の中ほどが円に届くまで）
  var WEIGHT_PX = 2;  // 線を太くする量。画面に表示された大きさでの px（お客様指定）

  function roughCircle(ctx, cx, cy, r, seed, k) {
    ctx.beginPath();
    for (var a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
      var n = (Math.sin(a * 7 + seed) * 1.4 + Math.sin(a * 17 + seed * 2) * 0.9 + Math.sin(a * 3 + seed) * 1.8) * k;
      var rr = r + n;
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // 文字列 → 列の配列（右の列が先頭）。縦書き1〜3文字は1列、4文字以上は2列。
  function toColumns(text) {
    var ch = text.split('');
    var nc = ch.length <= 3 ? 1 : 2;
    var per = Math.ceil(ch.length / nc), cols = [];
    for (var i = 0; i < nc; i++) cols.push(ch.slice(i * per, (i + 1) * per));
    return cols;
  }

  // 1文字を、実際の線の外形（インクの範囲）が枠 [x0,x1]×[y0,y1] いっぱいになるよう伸縮して描く
  function drawFit(ctx, ch, x0, y0, x1, y1) {
    var B = 200;
    ctx.font = '400 ' + B + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var m = ctx.measureText(ch);
    var L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight;
    var A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
    // 「一」のように線が極端に細い字を枠いっぱいに伸ばさないよう、外形に下限を設ける
    var iw = Math.max(L + R, B * 0.45), ih = Math.max(A + D, B * 0.45);
    var sx = (x1 - x0) / iw, sy = (y1 - y0) / ih;
    if (sx / sy > ANISO) sx = sy * ANISO;
    if (sy / sx > ANISO) sy = sx * ANISO;
    ctx.save();
    ctx.translate((x0 + x1) / 2, (y0 + y1) / 2);
    ctx.scale(sx, sy);
    ctx.fillText(ch, -(R - L) / 2, -(D - A) / 2);
    ctx.restore();
  }

  var textLayer = document.createElement('canvas');
  var boldLayer = document.createElement('canvas');

  /* 篆書の字形がすでに届いているか。
     Adobe Fonts（日本語）はダイナミックサブセットで、ページの文章に出てくる字だけを
     配信する。canvas に描く字は文章にないため、届いていない字をそのまま描くと
     ブラウザの代わりの書体（ゴシック体）で出てしまう。
     読み込み済みの篆書フォントの unicode-range に全部の字が入っているときだけ描く。 */
  var rangeCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function faceCodes(f) {
    var set = rangeCache && rangeCache.get(f);
    if (set) return set;
    set = {};
    f.unicodeRange.split(',').forEach(function (part) {
      var m = part.trim().replace(/^U\+/i, '').split('-');
      var a = parseInt(m[0].replace(/\?/g, '0'), 16);
      var b = m[1] ? parseInt(m[1], 16) : parseInt(m[0].replace(/\?/g, 'F'), 16);
      for (var c = a; c <= b && c - a < 70000; c++) set[c] = true;
    });
    if (rangeCache) rangeCache.set(f, set);
    return set;
  }
  function tenshoReady(text) {
    if (!document.fonts) return true;
    var faces = [];
    document.fonts.forEach(function (f) {
      if (/tenshokk/i.test(f.family) && f.status === 'loaded') faces.push(faceCodes(f));
    });
    if (!faces.length) return false;
    return text.split('').every(function (ch) {
      var cp = ch.codePointAt(0);
      return faces.some(function (set) { return set[cp]; });
    });
  }

  // 教育漢字1,026字を見えない形でページに置き、Adobe Fonts に全字の字形を配信させる
  (function requestAllGlyphs() {
    var sp = document.createElement('span');
    sp.setAttribute('aria-hidden', 'true');
    sp.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;' +
      'white-space:nowrap;font-family:"hot-tenshokk";font-weight:400;';
    sp.textContent = KYOIKU;
    document.body.appendChild(sp);
    // 最初の読み込みが済んだ後に、もう一度読み込ませて上の字を拾わせる
    (function reload(n) {
      if (window.Typekit && /\bwf-(active|inactive)\b/.test(document.documentElement.className)) {
        try { window.Typekit.load({ async: true }); } catch (e) {}
      } else if (n > 0) setTimeout(function () { reload(n - 1); }, 200);
    })(50);
  })();

  function drawLegacySeal(cv, text) {
    var out = cv.getContext('2d');
    var W = cv.width, c0 = W / 2;
    var k = W / 720;
    out.clearRect(0, 0, W, W);

    // 背景は透明。サイトの背景に朱の文字と枠を重ねる。

    // 印郭（円の輪郭線）
    out.strokeStyle = RED;
    out.lineWidth = W * 0.032;
    roughCircle(out, c0, c0, W * 0.44, 1.7, k);
    out.stroke();

    // 篆書がまだ届いていない字があるときは文字を描かない（ゴシック体では出さない）。
    // 届いたら loadingdone で描き直す。
    if (text && tenshoReady(text)) {
      textLayer.width = textLayer.height = boldLayer.width = boldLayer.height = W;
      var ctx = textLayer.getContext('2d');
      ctx.fillStyle = RED;
      // 文字を置ける円の半径（印郭の内側）と、文字間・行間（半径比）
      var Rin = W * 0.44 - W * 0.016 - W * 0.008, gap = 0.035, pad = 0.03;
      var chord = function (t) { return Math.sqrt(Math.max(0, 1 - t * t)); };
      var cols = toColumns(text), nc = cols.length;
      cols.forEach(function (col, ci) {
        var nr = col.length;
        var Y = nr === 1 ? 0.78 : nr === 2 ? 0.84 : nr === 3 ? 0.88 : 0.9;
        var xr = 1 - ci * (2 / nc), xl = xr - 2 / nc;
        if (ci > 0) xr -= gap / 2;
        if (ci < nc - 1) xl += gap / 2;
        col.forEach(function (ch, ri) {
          var y0 = -Y + ri * (2 * Y / nr), y1 = y0 + 2 * Y / nr;
          if (ri > 0) y0 += pad / 2;
          if (ri < nr - 1) y1 -= pad / 2;
          // 外側の角が円からはみ出さない枠（横幅を円の弦の長さで切る）
          var yOut = Math.max(Math.abs(y0), Math.abs(y1));
          var x0 = Math.max(xl, -chord(yOut)), x1 = Math.min(xr, chord(yOut));
          if (x1 <= x0) return;
          // 円に面している辺だけを、辺の中ほどで円に届く長さに向けて外へ広げる
          var yIn = (y0 <= 0 && y1 >= 0) ? 0 : Math.min(Math.abs(y0), Math.abs(y1));
          var xIn = (x0 <= 0 && x1 >= 0) ? 0 : Math.min(Math.abs(x0), Math.abs(x1));
          var edgeX = chord(yIn), edgeY = chord(xIn);
          if (ci === 0) x1 += (edgeX - x1) * REACH;
          if (ci === nc - 1) x0 += (-edgeX - x0) * REACH;
          if (ri === 0) y0 += (-edgeY - y0) * REACH;
          if (ri === nr - 1) y1 += (edgeY - y1) * REACH;
          drawFit(ctx, ch, c0 + x0 * Rin, c0 + y0 * Rin, c0 + x1 * Rin, c0 + y1 * Rin);
        });
      });

      // 線を太くする。伸縮の向きに関係なく同じ幅になるよう、strokeText ではなく
      // 描いた文字を周囲16方向にずらして重ねる（膨張処理）。
      // 太さは画面上の見た目で WEIGHT_PX になるよう、実際の表示幅から換算する。
      var shown = cv.offsetWidth || 250;
      var r = WEIGHT_PX * (W / shown) / 2;
      var b = boldLayer.getContext('2d');
      b.drawImage(textLayer, 0, 0);
      for (var i = 0; i < 16; i++) {
        var a = i / 16 * Math.PI * 2;
        b.drawImage(textLayer, Math.cos(a) * r, Math.sin(a) * r);
        b.drawImage(textLayer, Math.cos(a) * r / 2, Math.sin(a) * r / 2);
      }

      out.save();
      out.beginPath(); out.arc(c0, c0, W * 0.44, 0, Math.PI * 2); out.clip();
      out.drawImage(boldLayer, 0, 0);
      out.restore();
    }

    // 朱肉のかすれは透明に抜き、紙色を残さない。
    out.save();
    out.globalCompositeOperation = 'destination-out';
    out.fillStyle = PAPER;
    var grains = Math.round(900 * k * k);
    for (var g = 0; g < grains; g++) {
      var a0 = Math.random() * Math.PI * 2, rr0 = Math.sqrt(Math.random()) * W * 0.46;
      out.globalAlpha = Math.random() * 0.35;
      out.fillRect(c0 + Math.cos(a0) * rr0, c0 + Math.sin(a0) * rr0, (Math.random() * 3 + 1) * k, (Math.random() * 3 + 1) * k);
    }
    out.restore();
  }

  // 2026-09-30 approved: fixed rendering by character count, independent of name.
  const SEAL_PRESETS=Object.freeze({
    2:Object.freeze({width:480,height:286,gap:8,verticalScale:1,weight:2.8}),
    3:Object.freeze({width:384,height:190,gap:8,verticalScale:.98,weight:2}),
    4:Object.freeze({width:272,height:286,gap:8,verticalScale:1,weight:2})
  });
  const makeLayer=()=>{const c=document.createElement('canvas');c.width=c.height=720;return c};
function drawSeal(cv,text){
 if(!SEAL_PRESETS[text.length]){drawLegacySeal(cv,text);return;}
 const preset=SEAL_PRESETS[text.length],tight=true;
 const W=720,ctx=cv.getContext('2d');ctx.clearRect(0,0,W,W);
 if(text&&tenshoReady(text)){
  const layer=makeLayer(),g=layer.getContext('2d');g.fillStyle=RED;
  let cols=toColumns(text);
  const gap=preset.gap;
  const stretch=1;
  cols.forEach((col,ci)=>col.forEach((ch,ri)=>{
   const nc=cols.length,nr=text.length===3&&nc===2?2:col.length;
   const cw=preset.width,cellH=preset.height;
   const cx=nc===1?360:360+(ci===0?1:-1)*(cw+gap)/2;
   const cy=360+(ri-(nr-1)/2)*(cellH+gap);
   g.font='400 220px '+FONT;g.textAlign='center';g.textBaseline='middle';
   const m=g.measureText(ch),iw=Math.max(m.actualBoundingBoxLeft+m.actualBoundingBoxRight,99),ih=Math.max(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent,99);
   const flower=tight&&ch==='花'&&nc===2&&nr===2;
   const sx=cw/iw*(flower?.97:1),sy=cellH/ih*stretch*(flower?.97:1)*preset.verticalScale;
   const three=(text.length===2||text.length===3)&&nc===1;
   const ink=three?makeLayer():null,pen=three?ink.getContext('2d'):g;
   pen.font=g.font;pen.textAlign='center';pen.textBaseline='middle';pen.fillStyle=RED;
   pen.save();pen.translate(cx+(flower?8:0),cy+(flower?18:0));pen.scale(sx,sy);
   pen.fillText(ch,-(m.actualBoundingBoxRight-m.actualBoundingBoxLeft)/2,-(m.actualBoundingBoxDescent-m.actualBoundingBoxAscent)/2);pen.restore();
   if(three){
    // Compensate for the different x/y scale of the three-character layout.
    // Four-character rendering remains untouched. The common +2px follows below.
    const corrected=makeLayer(),c=corrected.getContext('2d');c.drawImage(ink,0,0);
    const thinX=Math.max(0,(sx-272/iw)*5);
    c.globalCompositeOperation='destination-in';
    for(let d=.5;d<thinX;d+=.5){c.drawImage(ink,d,0);c.drawImage(ink,-d,0)}
    if(thinX){c.drawImage(ink,thinX,0);c.drawImage(ink,-thinX,0)}
    const thickenY=Math.min(1.5,Math.max(0,(286/ih*stretch-sy)*2.5));
    g.drawImage(corrected,0,0);
    for(let d=.5;d<thickenY;d+=.5){g.drawImage(corrected,0,d);g.drawImage(corrected,0,-d)}
    if(thickenY){g.drawImage(corrected,0,thickenY);g.drawImage(corrected,0,-thickenY)}
   }
  }));
  const bold=makeLayer(),b=bold.getContext('2d'),r=preset.weight*(W/(cv.offsetWidth||250))/2;
  b.drawImage(layer,0,0);for(let i=0;i<16;i++){const a=i*Math.PI/8;b.drawImage(layer,Math.cos(a)*r,Math.sin(a)*r);b.drawImage(layer,Math.cos(a)*r/2,Math.sin(a)*r/2)}
  ctx.save();ctx.beginPath();ctx.arc(360,360,W*.44,0,Math.PI*2);ctx.clip();ctx.drawImage(bold,0,0);ctx.restore();
 }
 ctx.strokeStyle=RED;ctx.lineWidth=W*.026;ctx.beginPath();ctx.arc(360,360,W*.44,0,Math.PI*2);ctx.stroke();
}

  var input = document.getElementById('nameInput');
  var readingOut = document.getElementById('readingOut');
  var paperSheet = document.querySelector('.paper-sheet');

  function draw() {
    var text = toKanji(input.value || '');
    readingOut.textContent = text || '—';
    drawSeal(canvas, text);
  }

  function update() {
    draw();
    // 印を捺す瞬間のような、軽く弾む演出
    if (paperSheet) {
      paperSheet.classList.remove('is-stamped');
      void paperSheet.offsetWidth;
      paperSheet.classList.add('is-stamped');
    }
  }

  input.addEventListener('input', update);
  document.querySelectorAll('.chip').forEach(function (b) {
    b.addEventListener('click', function () { input.value = b.dataset.name; update(); });
  });

  // 表示幅が変わると太さの換算が変わるので描き直す
  var resizeTimer;
  addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 150);
  });

  // 篆書フォントの読み込み後に描き直す。Typekit の読み込み直後は canvas に
  // まだ反映されないことがあるため、少し遅らせてもう一度描く。
  function redrawWhenFontReady(n) {
    if (!document.fonts) return;
    var registered = false;
    document.fonts.forEach(function (f) {
      if (/tenshokk/i.test(f.family)) registered = true;
    });
    if (registered) {
      document.fonts.load('400 100px "hot-tenshokk"', KYOIKU).then(function () {
        draw();
        if (!tenshoReady(toKanji(input.value || '')) && n > 0) {
          setTimeout(function () { redrawWhenFontReady(n - 1); }, 500);
        }
      }).catch(function () {
        if (n > 0) setTimeout(function () { redrawWhenFontReady(n - 1); }, 500);
      });
    } else if (n > 0) {
      setTimeout(function () { redrawWhenFontReady(n - 1); }, 500);
    }
  }
  redrawWhenFontReady(60);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', function () { draw(); });
  draw();

  /* ---------------- 5. 文字を行単位に切って表示 ----------------
     単語を一度 span に包んで offsetTop を測り、同じ高さのものを1行にまとめる。
     行ごとに overflow:hidden の器を作り、中身を下から迫り上げる。
     data-sweep が付いていれば朱色のバーが右へ抜ける。
     言語切替のたびに組み直す（行の折れ位置が変わるため）。
  -------------------------------------------------------------- */
  var STEP = 0.07;   // 行ごとの遅延（秒）

  function splitOne(el) {
    if (el.__spOriginal == null) el.__spOriginal = el.innerHTML;
    el.innerHTML = el.__spOriginal;

    // <br> を区切り記号に置き換えてから、そこで分ける
    var MARK = '\u0001';
    var parts = el.__spOriginal.replace(/<br\s*\/?>/gi, MARK).split(MARK);
    var frag = document.createDocumentFragment();

    parts.forEach(function (part, pi) {
      var tmp = document.createElement('div');
      tmp.innerHTML = part;
      var text = tmp.textContent;
      // 日本語は文字単位、英語は単語単位で折り返しを測る
      var isCJK = /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
      // FV uses its two editorial lines, including punctuation, as indivisible units.
      var tokens = el.hasAttribute('data-split-explicit') ? [text] :
        (isCJK ? text.split('') : text.split(/\s+/));

      tokens.forEach(function (t) {
        if (t === '') return;
        // 日本語文中の半角スペース（引用の英単語まわりなど）は
        // 単体の span にすると行の折り返し判定を乱すため、素のテキストノードで流す
        if (isCJK && /^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
        var s = document.createElement('span');
        s.className = 'sp-word';
        s.style.display = 'inline-block';
        s.textContent = t;
        frag.appendChild(s);
        if (!isCJK) frag.appendChild(document.createTextNode(' '));
      });

      if (pi < parts.length - 1) {
        var br = document.createElement('span');
        br.className = 'sp-break';
        frag.appendChild(br);
      }
    });
    el.innerHTML = '';
    el.appendChild(frag);

    // offsetTop で行にまとめる
    var kids = Array.prototype.slice.call(el.childNodes);
    var lines = [], cur = [], top = null;
    kids.forEach(function (n) {
      if (n.nodeType === 1 && n.className === 'sp-break') {
        if (cur.length) lines.push(cur);
        cur = []; top = null; return;
      }
      if (n.nodeType === 1) {
        var t = n.offsetTop;
        if (top === null) top = t;
        else if (Math.abs(t - top) > 2) { lines.push(cur); cur = []; top = t; }
      }
      cur.push(n);
    });
    if (cur.length) lines.push(cur);

    var sweep = el.hasAttribute('data-sweep');
    el.innerHTML = '';
    lines.forEach(function (nodes, i) {
      var line = document.createElement('span');
      line.className = 'sp-line';
      line.style.setProperty('--sp-delay', (i * STEP).toFixed(2) + 's');
      var inner = document.createElement('span');
      inner.className = 'sp-inner';
      nodes.forEach(function (n) { inner.appendChild(n); });
      line.appendChild(inner);
      if (sweep) {
        var bar = document.createElement('span');
        bar.className = 'sp-bar';
        line.appendChild(bar);
      }
      el.appendChild(line);
    });
    el.classList.add('is-split');
  }

  var splitObserver = null;
  function buildSplits() {
    if (splitObserver) splitObserver.disconnect();
    var els = document.querySelectorAll('[data-split]');
    // フォント読み込み完了やリサイズで再構築される際、すでに「表示済み」だった
    // 要素を憶えておく。ここで単純に .in を外すと、ユーザーがその要素を
    // スクロールで通り過ぎた後（＝もう画面外）だった場合、IntersectionObserver は
    // 二度と発火せず、その見出しは永久にグレーのまま固まってしまう。
    var wasIn = new Set();
    els.forEach(function (el) {
      if (el.classList.contains('in')) wasIn.add(el);
      el.classList.remove('in');
      splitOne(el);
    });

    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    splitObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); splitObserver.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });

    els.forEach(function (el) {
      // ヒーローなど最初から見えている要素、および直前まで表示済みだった要素はすぐ動かす
      if (el.hasAttribute('data-split-now') || wasIn.has(el)) {
        requestAnimationFrame(function () { el.classList.add('in'); });
      } else {
        splitObserver.observe(el);
      }
    });
  }

  var splitTimer = null;
  addEventListener('resize', function () {
    clearTimeout(splitTimer);
    splitTimer = setTimeout(buildSplits, 220);
  });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildSplits);
  else buildSplits();
  window.__rebuildSplits = buildSplits;

  /* ---------------- 6. マーキー ----------------
     基本は一定速度で流し、スクロール中は速度を上乗せする。
     スクロールの向きが変わると流れる向きも反転する。
  ------------------------------------------------ */
  document.querySelectorAll('[data-marquee]').forEach(function (track) {
    var row = track.firstElementChild;
    if (!row) return;
    // 途切れないよう、幅が画面の2倍を超えるまで複製する
    var base = row.cloneNode(true);
    var guard = 0;
    while (track.scrollWidth < innerWidth * 2 && guard < 12) {
      track.appendChild(base.cloneNode(true)); guard++;
    }
    var unit = row.offsetWidth;
    var speed = parseFloat(track.dataset.marqueeSpeed || '40'); // px/秒
    var dir = track.dataset.marqueeDir === 'right' ? 1 : -1;
    var x = 0, boost = 0, last = performance.now(), lastY = scrollY;

    addEventListener('scroll', function () {
      var dy = scrollY - lastY;
      lastY = scrollY;
      boost += dy * 1.6;
      if (Math.abs(dy) > 0.5) dir = dy > 0 ? -1 : 1;   // 下スクロールで左へ
    }, { passive: true });

    (function tick(now) {
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      boost *= 0.92;                                    // 惰性を減衰
      x += dir * speed * dt + boost * dt * 4;
      if (unit > 0) x = ((x % unit) + unit) % unit - unit;
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      requestAnimationFrame(tick);
    })(performance.now());
  });

  /* ---------------- 6b. スクロール連動で縮むカード ----------------
     親（.statement）を通過する進捗 0→1 を測り、--k として渡す。
     幅は CSS 側で min と max を補間しているので、ここは数値を1つ渡すだけ。
  ----------------------------------------------------------------- */
  (function shrinkOnScroll() {
    var cards = document.querySelectorAll('[data-shrink]');
    if (!cards.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var items = [];
    cards.forEach(function (el) {
      var track = el.closest('.statement');
      if (track) items.push({ el: el, track: track });
    });
    if (!items.length) return;

    var ticking = false;
    function update() {
      ticking = false;
      items.forEach(function (it) {
        var r = it.track.getBoundingClientRect();
        var span = r.height - innerHeight;      // 進める余地
        if (span <= 0) { it.el.style.setProperty('--k', '1'); return; }
        var p = Math.min(1, Math.max(0, -r.top / span));
        // 序盤は大きいまま、中盤で一気に縮む
        var k = 1 - Math.pow(p, 1.35);
        it.el.style.setProperty('--k', k.toFixed(4));
      });
    }
    addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    addEventListener('resize', update);
    update();
  })();

  /* ---------------- 7. カバーフロー ----------------
     中央のカードが正面、離れるほど奥へ下がって傾く。
     ループはDOMを複製せず、距離を「短い方の回り」に畳んで実現する。
  -------------------------------------------------- */
  (function coverflow() {
    var stage = document.getElementById('cfStage');
    var ring = document.getElementById('cfRing');
    if (!stage || !ring) return;

    /* 実際の取扱6種（印鑑資料 2025年8月版）。
       price は同資料の個人用13.5mm・税抜を仮置き。確定後に差し替えること。 */
    var MATS = [
      { img: 'tsuge', imgFile: 'hanko-tsuge-v2.png', en: 'Satsuma Boxwood', ja: '薩摩本柘', price: '¥3,500', size: '13.5mm',
        lead: { en: '7–10 days', ja: '7〜10日' },
        descEn: 'Grown in Kagoshima and close-grained enough to hold a fine line. The wood a comb is cut from.',
        descJa: '鹿児島県産の柘植。目が細かく密度が高いため、細い線までしっかり拾います。' },
      { img: 'kokusuigyu', imgFile: 'hanko-kokusuigyu-v2.png', en: 'Black Buffalo Horn', ja: '黒水牛芯持', price: '¥5,000', size: '13.5mm',
        lead: { en: '7–10 days', ja: '7〜10日' },
        descEn: 'Cut from the core of the horn alone, so it will not warp. Dense fibre, and the red reads clean.',
        descJa: '角の中心部分だけを使うため歪みません。繊維が詰まり、朱がきれいに読めます。' },
      { img: 'aguni', imgFile: 'hanko-aguni-v2.png', en: 'Agni', ja: 'アグニ', price: '¥5,000', size: '13.5mm',
        lead: { en: '7–10 days', ja: '7〜10日' },
        descEn: 'Birch, sliced and pressed under high heat. Stronger than the raw wood, and no two grains repeat.',
        descJa: 'カバの木を高圧加工した印材。天然材より強く、同じ木目は二つとありません。' },
      { img: 'oranda', imgFile: 'hanko-oranda-v2.png', en: 'Oranda Buffalo Horn', ja: 'オランダ水牛', price: '¥6,000', size: '13.5mm',
        lead: { en: '10–14 days', ja: '10〜14日' },
        descEn: 'The translucent, milk-white part of the horn. Every one is marked differently; none can be matched.',
        descJa: '角の中でも透明感のある乳白色の部分。一本ずつ模様が違い、同じものはありません。' },
      { img: 'rosequartz', imgFile: 'hanko-rosequartz-v2.png', en: 'Rose Quartz', ja: 'ローズクォーツ', price: '¥24,000', size: '13.5mm',
        lead: { en: '2–3 weeks', ja: '2〜3週間' },
        descEn: 'The stone of love and beauty. Given for a good match, and meant to be kept for a lifetime.',
        descJa: '愛と美を象徴する天然石。良縁を呼ぶとされ、贈り物にも選ばれます。' },
      { img: 'tigereye', imgFile: 'hanko-tigereye-v2.png', en: "Tiger's Eye", ja: '虎目石', price: '¥35,000', size: '13.5mm',
        lead: { en: '2–3 weeks', ja: '2〜3週間' },
        descEn: 'Banded stone that catches the light as it turns. Carried for fortune in money and in work.',
        descJa: '光の角度で縞が輝く天然石。金運・仕事運を高めるとされ、実印にも選ばれます。' }
    ];
    var LABELS = {
      en: { price: 'Price', size: 'Size', lead: 'Lead time' },
      ja: { price: '価格',  size: 'サイズ', lead: '納期' }
    };

    var ROT = 44, DEPTH = 0.6, FALL = 0.56, FADE = 0.1, GAP = 0.05;
    var N = MATS.length, cards = [], W = 0, PITCH = 0;
    var pos = 0, target = 0, raf = null, sel = -1, drag = null;

    var nameEl = document.getElementById('cfName');
    var subEl  = document.getElementById('cfSub');
    var metaEl = document.getElementById('cfMeta');
    var dotsEl = document.getElementById('cfDots');

    /* カルーセルの1枚を、下の一覧と同じ「商品カード」として組み立てる。
       画像だけでなく品名・説明・価格・ボタンまでカードに載せるため、
       言語切替時に文言を差し替えられるよう要素を保持しておく。 */
    var cardParts = [];

    MATS.forEach(function (m, i) {
      var c = document.createElement('article');
      c.className = 'cf-card';
      c.setAttribute('role', 'group');
      c.setAttribute('aria-label', (i + 1) + ' / ' + N);

      var visual = document.createElement('div');
      visual.className = 'cf-card-visual';
      var img = document.createElement('img');
      img.src = 'assets/' + (m.imgFile || ('hanko-' + m.img + '.png'));
      img.alt = '';
      img.loading = 'lazy';
      img.draggable = false;
      visual.appendChild(img);

      var body = document.createElement('div');
      body.className = 'cf-card-body';
      var h3   = document.createElement('h3');
      var desc = document.createElement('p'); desc.className = 'cf-card-desc';
      var price = document.createElement('p'); price.className = 'price';
      var priceMain = document.createElement('span');
      var priceSub  = document.createElement('span'); priceSub.className = 'price-sub';
      price.appendChild(priceMain); price.appendChild(document.createTextNode(' ')); price.appendChild(priceSub);
      var buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'btn btn-primary btn-block';
      body.appendChild(h3); body.appendChild(desc); body.appendChild(price); body.appendChild(buy);

      c.appendChild(visual); c.appendChild(body);
      ring.appendChild(c);
      cards.push(c);
      cardParts.push({ h3: h3, desc: desc, priceMain: priceMain, priceSub: priceSub, buy: buy });

      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', m.en);
      b.addEventListener('click', function () { goTo(i); });
      dotsEl.appendChild(b);
    });

    /* カード上の文言を現在の言語で埋め直す。言語切替からも呼ばれる。 */
    function renderCards() {
      MATS.forEach(function (m, i) {
        var p = cardParts[i];
        p.h3.textContent   = (lang === 'ja' ? m.ja : m.en) + ' ' + m.size;
        p.desc.textContent = (lang === 'ja' ? m.descJa : m.descEn);
        p.priceMain.textContent = m.price;
        p.priceSub.textContent  = m.lead[lang] || m.lead.en;
        p.buy.textContent = (lang === 'ja' ? 'カートに入れる' : 'Add to cart');
      });
    }

    function measure() {
      W = cards[0].offsetWidth || 200;
      PITCH = W * (1 + GAP);
      paint();
    }
    function idxAt(p) { return ((Math.round(p) % N) + N) % N; }

    function paint() {
      if (!W) return;
      for (var i = 0; i < N; i++) {
        var off = i - pos;
        off = ((off % N) + N) % N;
        if (off > N / 2) off -= N;
        var d = Math.abs(off);
        var ramp = Math.pow(d, FALL);
        var tilt = Math.min(ROT * ramp, 82) * Math.sign(off);
        cards[i].style.transform =
          'translateX(calc(-50% + ' + (off * PITCH) + 'px)) ' +
          'translateZ(' + (-DEPTH * W * ramp) + 'px) rotateY(' + (-tilt) + 'deg)';
        var edge = Math.min(1, Math.max(0, N / 2 - d));
        cards[i].style.opacity = String(Math.max(0, 1 - FADE * d) * edge);
        cards[i].style.zIndex = String(100 - Math.round(d));
      }
    }

    function setSel(i) {
      if (i === sel) return;
      sel = i;
      renderCaption();
      dotsEl.querySelectorAll('button').forEach(function (b, j) {
        b.setAttribute('aria-current', String(j === i));
      });
    }

    function renderCaption() {
      if (sel < 0) return;
      var m = MATS[sel], L = LABELS[lang] || LABELS.en;
      nameEl.textContent = lang === 'ja' ? m.ja : m.en;
      subEl.textContent  = lang === 'ja' ? m.en : m.ja;
      metaEl.innerHTML = '';
      [[L.price, m.price], [L.size, m.size], [L.lead, m.lead[lang] || m.lead.en]].forEach(function (r) {
        var w = document.createElement('div');
        var dt = document.createElement('dt'); dt.textContent = r[0];
        var dd = document.createElement('dd'); dd.textContent = r[1];
        w.appendChild(dt); w.appendChild(dd); metaEl.appendChild(w);
      });
    }
    window.__cfRefresh = function () { renderCards(); renderCaption(); };
    renderCards();

    function settle(tg) {
      if (raf !== null) cancelAnimationFrame(raf);
      target = tg; setSel(idxAt(tg));
      (function step() {
        var rem = target - pos;
        if (Math.abs(rem) < 0.0004) { pos = target; paint(); raf = null; return; }
        pos += rem * 0.16; paint();
        raf = requestAnimationFrame(step);
      })();
    }
    function goTo(i) { settle(i + Math.round((target - i) / N) * N); }
    function nudge(by) { settle(Math.round(target) + by); }

    stage.addEventListener('pointerdown', function (e) {
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      stage.setPointerCapture(e.pointerId);
      target = pos;
      drag = { id: e.pointerId, x: e.clientX, p: pos, v: 0, t: performance.now() };
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId || !PITCH) return;
      var now = performance.now(), prev = pos;
      pos = drag.p - (e.clientX - drag.x) / PITCH;
      drag.v = ((pos - prev) / Math.max(now - drag.t, 1)) * 1000;
      drag.t = now;
      setSel(idxAt(pos)); paint();
    });
    function endDrag(e) {
      if (!drag || drag.id !== e.pointerId) return;
      var carried = Math.max(-2, Math.min(2, drag.v * 0.18));
      drag = null;
      settle(Math.round(pos + carried));
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); nudge(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
    });

    setSel(1); pos = 1; target = 1;
    measure();
    if (window.ResizeObserver) new ResizeObserver(measure).observe(stage);
  })();

  /* ---------------- 8. パララックス ----------------
     data-parallax を付けた要素を、ビューポート中心からのズレに
     応じて縦にずらす。速度は data-parallax-speed（0〜1目安）。
     背景写真（ヒーロー/シーン/クローザー）に奥行きを出すためだけに使う。
  --------------------------------------------------- */
  (function parallax() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    if (!els.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var items = els.map(function (el) {
      return { el: el, speed: parseFloat(el.dataset.parallaxSpeed || '0.2') };
    });
    var ticking = false;
    function update() {
      ticking = false;
      var vh = innerHeight;
      items.forEach(function (it) {
        var r = it.el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) return; // 画面から離れていれば計算しない
        var center = r.top + r.height / 2;
        var offset = (center - vh / 2) * it.speed;
        it.el.style.transform = 'translate3d(0,' + (-offset).toFixed(1) + 'px,0)';
      });
    }
    addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    addEventListener('resize', update);
    update();
  })();

  /* ---------------- 4. reveal + nav ---------------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  var nav = document.querySelector('.nav');
  addEventListener('scroll', function () {
    nav.classList.toggle('solid', scrollY > 60);
    // スクロールを始めたら、印鑑の待機中の揺れを止める
    document.body.classList.toggle('is-scrolled', scrollY > 40);
  }, { passive: true });
})();
