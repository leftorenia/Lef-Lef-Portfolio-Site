# Lunar Fluid Portfolio Redesign

## Goal

既存の「Silent Cosmos」ポートフォリオを、静かな月夜とインタラクティブな星雲を中心にした体験へ刷新する。訪問者が最初の数秒で「Shader / VFXを探究するれふれふのサイト」と理解でき、カーソルやタッチで雲を撫でるような流体表現を楽しめることを目標とする。

参照サイトからは、ポインター周辺のノイズ付きリビール、余韻の長い追従、音の有無を選べる導入という考え方だけを取り入れる。参照サイトのコード、画像、音源、ロゴ、文言、レイアウト数値は使用しない。添付画像は色と空気感の参考とし、画像そのものや加工・トレースした派生素材は公開サイトへ含めない。

## Audience and success criteria

主な閲覧者は、作者の活動を初めて知る人、Shader・VFX作品を見たい人、連絡先を探す人とする。

成功条件:

- ファーストビューだけで作者名、活動領域、作品への導線が分かる。
- 青い雲、星空、三日月が一貫した月夜の世界観をつくる。
- ポインター移動に応じて雲が浮き上がり、押し流され、光が染み出す。
- 音は訪問者の明示操作でのみ始まり、静かなアンビエントとして視覚体験を補助する。
- `PROFILE / WORKS / CONTACT`、既存作品、連絡先の内容を維持する。
- PCとスマートフォンで動作し、WebGL非対応、JavaScript無効、動きを減らす設定でも内容を利用できる。
- 外部ライブラリやビルド工程を追加せず、GitHub Pagesへそのまま配信できる。

## Experience structure

公開ナビゲーションは引き続き3項目とする。

1. `PROFILE` — `index.html`
2. `WORKS` — `works.html`
3. `CONTACT` — `contact.html`

旧 `about.html` は `index.html` への互換転送として残す。`works/cosmo-effects/index.html` も既存URLと静的HTMLの内容を維持する。

### Existing content contract

今回の変更は表現とレイアウトの刷新であり、確認済みコンテンツの削除・創作ではない。次の内容を保持する。

- Profileの作者名 `LEFLEF / れふれふ`、肩書き、現在の紹介文、探究領域4項目
- Worksの合計7カード、`COSMO EFFECTS` 1件と非リンクの `COMING SOON` 6件
- `COSMO EFFECTS` の既存タイトル、説明、`Unity VFX Study / Personal Study`、技術タグ、詳細ページ本文
- Contactのメール、GitHub、X、noteの4リンクと既存URL
- 各ページの説明メタデータ、フッター、`about.html` の互換転送

下部の注目作品には `COSMO EFFECTS` を使う。新しい作品、依頼実績、所属、受賞歴、制作年、クライアント情報は追加しない。既存テストが検出している `index.html` の欠落タイトルとブランド表記の不整合は、現在の意図どおり `PROFILE — れふれふ` と `LEFLEF` に修復する。

### First viewport

Profileの最初の画面は、おおむね左40%を情報、右60%を星雲に使う非対称構成にする。

- 上部: `LEFLEF / れふれふ` のブランドと3項目のナビゲーション
- 左中央: `SHADER / VFX`、名前、短い紹介文、Worksへのリンク
- 右中央: プロシージャルな青い星雲、星粒、細い三日月
- 下部: Sound切替、注目作品、スクロール案内

三日月は主役になりすぎない視線の錨として、雲の奥に淡く置く。情報側には暗い余白を残し、動く雲と本文の可読性を競合させない。

### Lower sections and other pages

Profile下部では既存の自己紹介と探究領域を維持し、細い星座線と月光の罫線でファーストビューから連続させる。

Worksは既存の1件の作品と6件のComing Soonを保持する。実作品カードではポインター周辺の発光と雲の薄いリビールを追加するが、作品画像が存在するような誤解は生じさせない。詳細ページは大きな生成プレビュー、概要、表現テーマ、使用技術を維持する。

Contactは連絡先を最優先とし、背景反応を弱める。ポインター周辺の星がわずかに増える程度に留める。

## Visual system

デザイン名は **Lunar Reverie** とする。

主要色:

- 夜空の最深部: `#030815`
- 深い紺: `#08152d`
- 雲影: `#112855`
- コバルト: `#284d86`
- 月光ブルー: `#6d91c9`
- 明るい雲: `#bed6f6`
- 淡い藤色: `#d7c4e7`
- ごく少量の暖色: `#f4d3c7`
- 月と本文: `#eef4ff`
- 罫線: `rgba(210, 225, 255, 0.18)`

暖色は月光が雲へ反射する局所的な色としてのみ使用し、画面の5%未満に抑える。本文は16px以上、常用UIは14px以上を基本とし、日本語本文には読みやすいサンセリフ、短い詩的見出しには端末で利用可能な明朝系フォールバックを使う。英字ラベルは広めの字間で技術的な印象を保つ。

細い罫線、広い余白、直線的な区切りを使い、過度なガラス表現、巨大な角丸、強いネオンは避ける。

## WebGL cloud renderer

各文書の全ページ共通背景Canvasは1枚に保ち、WebGL2で描画する。Works一覧と詳細に既存の作品プレビューCanvasが別に存在することは許容する。外部ライブラリは追加しない。WebGL2を利用できない場合はCSS静止背景へ切り替え、WebGL1向けの第二実装は持たない。

描画は以下のレイヤーを単一フラグメントシェーダー内で合成する。

1. 複数オクターブのノイズで生成する遠景・中景・前景の雲
2. ハッシュベースの星粒と低頻度の瞬き
3. SDFで描く細い三日月と柔らかな月光ハロー
4. ポインター軌跡による雲のUV変位、密度上昇、加算発光
5. 画面端と情報領域を暗く保つビネットと可読性マスク

ポインター軌跡はJavaScript側で最大12点の固定長スプラット列として保持し、位置と強度を1つの `vec4`、移動方向と経過時間をもう1つの `vec4` にパックしてuniform配列でシェーダーへ渡す。フラグメントシェーダーは各点のガウス状影響とcurl noiseを合成して雲のUV、密度、発光を変化させる。軌跡は停止後およそ2.5秒で夜空へ溶ける。反応半径はデスクトップで約180〜260pxとし、急な移動でも白いフラッシュや不連続な跳ねを発生させない。

品質は3段階とする。

- High: 内部描画倍率0.75、雲ノイズ4オクターブ、軌跡12点
- Medium: 内部描画倍率0.625、雲ノイズ3オクターブ、軌跡8点
- Low: 内部描画倍率0.5、雲ノイズ2オクターブ、軌跡4点

初期値はデスクトップHigh、モバイルMediumとする。直近90フレームの平均フレーム時間が22msを超えた場合は一段階だけ品質を下げ、同一ページ内で自動的には上げ直さない。実際のCanvasバッファ寸法はCSS寸法、上限DPR、内部描画倍率から計算する。

ページごとの見せ方は `pageMode` で固定する。

- `profile`: 雲と軌跡を最大強度、左40%へ可読性マスク、月を表示
- `works`: 雲と軌跡を約70%、月を弱く表示
- `contact`: 雲を約45%、軌跡の密度変位を止め、星の増光だけを使用
- `detail`: 雲を約60%、月を非表示にし、作品プレビューを主役にする

実装モジュールは次の公開インターフェースを持つ。

- `getSceneMetrics(options)` — DPR、品質、描画可否、モーション設定を純粋計算する。
- `createLunarScene(canvas, options)` — WebGL2シーンの生成、描画、品質変更、リサイズ、コンテキスト喪失・復帰、破棄を担当する。
- `bootLunarField(document, window)` — `body[data-page]` を `pageMode` へ変換し、DOMからCanvasを取得または生成してページ全体のライフサイクルへ接続する。

現在の `bootCosmicField` 利用箇所との互換性を保つか、全ページとテストを同時に新しい名前へ移行する。中途半端な二重実装は残さない。

## Rendering fallback and performance

- CanvasのCSS寸法は常に表示領域へ追従させる。
- DPRは最大1.5、低性能・モバイルでは1.0を基本とする。
- タブが非表示の間はアニメーションを停止する。
- `prefers-reduced-motion: reduce` ではRAFループを開始せず、軌跡追従、星の瞬き、自動ドリフトを停止する。起動時、リサイズ、DPR変化、設定変更時だけ静的な月夜を再描画する。
- モバイルではタッチ移動に反応させ、操作がない間はごく遅い自動ドリフトを使う。入力はCanvasではなく `window` のpassive Pointer Eventsで受け、`clientX/clientY` を表示領域へ正規化する。`preventDefault()` は使わず、スクロールやリンク操作を妨げない。
- WebGL初期化やシェーダーコンパイルに失敗した場合は、CSSグラデーションで構成した静的月夜へフォールバックする。二重の描画実装は持たない。
- JavaScriptが無効でも、CSS背景、ナビゲーション、本文、作品情報、連絡先を表示する。
- Canvasは `aria-hidden="true"`、`pointer-events: none` とし、通常のHTML操作を遮らない。
- `webglcontextlost` ではRAFを停止して静的フォールバックを表示し、`webglcontextrestored` ではリソースを一度だけ再構築する。全イベントは `destroy()` で解除する。

## Procedural ambient audio

音声ファイルは追加せず、Web Audio APIでオリジナルのアンビエント音をリアルタイム生成する。

音は次の層で構成する。

- 複数の低いOscillatorをゆっくり揺らす柔らかなパッド
- フィルターを通した低音量のノイズによる遠い風
- 不規則かつ低頻度に鳴る、短いベル状の倍音
- Master Gainを通した十分に小さい出力

自動再生は行わない。初回訪問はSound Offとし、利用者が明示的にボタンを押したときだけ `AudioContext` を生成または再開する。ON/OFFは約1秒でフェードする。希望状態はGitHub Pages上の他リポジトリと衝突しない `lef-lef-portfolio:ambient-enabled` キーで `localStorage` に保存する。

保存する希望状態と実際の再生状態を分離し、UIは次の4状態を持つ。

- `off`: 希望状態がOff。表示は `SOUND OFF`、`aria-pressed="false"`。
- `needs-gesture`: 保存された希望状態はOnだが、このページではまだ再生許可を得ていない。表示は `START SOUND`、`aria-pressed="false"`。
- `playing`: AudioContextがrunningで出力中。表示は `SOUND ON`、`aria-pressed="true"`。
- `unavailable`: Web Audio APIが恒久的に利用できない。表示は `SOUND UNAVAILABLE`、`aria-pressed="false"`、ボタンを無効化する。

新しいページロードで保存値がOnでも、自動でAudioContextを生成せず `needs-gesture` から始める。ユーザー操作中の `resume()` が一時的に拒否された場合は `needs-gesture` に戻して再試行を許す。Off操作ではフェード完了後にベルのスケジューラーを停止してContextをsuspendし、再度Onにしたとき既存ノードを再利用する。同一ページ内の反復操作でOscillator、BufferSource、タイマーを重複生成しない。

サウンドUIはすべての主要ページに表示し、ボタン、`aria-pressed`、目に見えるフォーカス、現在状態のテキストを持たせる。ページが非表示になった場合はフェード後にスケジューラーを停止してContextをsuspendし、復帰時は `needs-gesture` として再開操作を求める。Master Gainは最大0.06とし、DynamicsCompressorNodeを最終段に置いてクリッピングを防ぐ。

音声モジュールは次の公開インターフェースを持つ。

- `readAmbientPreference(storage)` — 名前空間付き保存値を安全に読み取る純粋ヘルパー
- `createAmbientSound(options)` — `enableFromGesture()`、`disable()`、`setHidden()`、`destroy()` と現在状態を提供する
- `bootAmbientSound(document, window)` — `[data-sound-toggle]` へUI状態と操作を接続する

`destroy()` はスケジューラーを止め、生成済みSourceを停止し、全ノードとイベントを切断する。

## Accessibility

- 本文と操作要素は背景に対してWCAG AA相当（通常文字4.5:1以上、大きな文字3:1以上）のコントラストを確保する。
- キーボードフォーカスは月光色の明瞭なアウトラインで示す。
- 音の状態を色だけで伝えない。
- 音が鳴る前に、サイトがアンビエント音を利用できることを短く明示する。
- 3Hzを超える点滅、強い白フラッシュ、連続するクリック音を使わない。
- 主要導線と本文はCanvasや音に依存させない。
- `prefers-reduced-motion` とサウンド設定は別の利用者選択として扱う。

## Files and responsibilities

想定する主な変更:

- `index.html` — Lunar Reverieのファーストビューと下部ステータスバー
- `works.html` — 共通背景、Sound UI、控えめなカード反応
- `contact.html` — 共通背景とSound UI
- `works/cosmo-effects/index.html` — 共通背景とSound UI、作品プレビューの配色整合
- `assets/css/style.css` — 新しい色、レイヤー、レイアウト、レスポンシブ、フォールバック
- `assets/js/lunar-field.js` — WebGL星雲、星、月、ポインター軌跡、フォールバック
- `assets/js/ambient-sound.js` — Web Audio生成、状態管理、UI、ライフサイクル
- `assets/js/work-preview.js` — Lunar Reverieパレットとの整合
- `tests/lunar-field.test.mjs` — 品質設定、フォールバック、リサイズ、モーション設定
- `tests/ambient-sound.test.mjs` — 初期OFF、明示開始、フェード、保存、破棄
- 既存の構造・CSS契約テスト — 新しいHTMLとポリシーに合わせて更新
- `README.md` — 視覚・音・フォールバック・確認手順を更新

既存 `assets/js/cosmic-field.js` は、全ページとテストを新モジュールへ移行した後に削除する。

## Error handling and resilience

- WebGLコンテキスト取得失敗は例外としてページ全体へ伝播させず、静的フォールバックへ切り替える。
- シェーダーコンパイルまたはリンク失敗時は開発者向け情報をコンソールへ一度だけ出し、訪問者向け本文は通常どおり表示する。
- `AudioContext` が存在しない場合は `unavailable` にする。ユーザー操作中の生成・再開が一時的に拒否された場合は `needs-gesture` に戻し、再試行可能な状態にする。
- `localStorage` が利用不可でも、現在ページ内のSound操作は動作させる。
- ページ非表示、リサイズ、モーション設定変更のイベントは `destroy()` で必ず解除する。

## Testing and verification

自動確認:

- `npm test` で既存の構造・リンク・アクセシビリティ契約と新しい描画・音声契約を確認する。
- WebGL2非対応、シェーダー失敗、Web Audio非対応、`localStorage` 例外を依存注入した単体テストで確認する。Canvas 2Dコンテキストは背景描画に要求しないことも確認する。
- DPR上限、モバイル品質、ゼロ寸法、ライブリサイズ、visibility、モーション設定変更、破棄後のイベント解除を確認する。
- 初期状態で音が開始しないこと、明示操作でのみ開始すること、4状態の遷移、反復操作でノードやタイマーが重複しないこと、Master Gainが0.06以下でフェード値が有限範囲に収まることを確認する。
- 全 `href`、`src`、ES module importを `https://leftorenia.github.io/Lef-Lef-Portfolio-Site/` を基準に解決し、ネストした詳細ページを含めて存在確認する。`/assets/...` のようなルート相対URLは禁止する。

表示確認:

- `1440×1000`、`900×1000`、`390×844` でProfile、Works、Contact、作品詳細を確認する。
- ポインター速度別の雲反応、停止後の減衰、タッチ操作、スクロール後の描画を確認する。
- Sound On/Off、ページ再読み込み後、タブ非表示・復帰、AudioContext拒否時を確認する。
- 通常モーション、低モーション、WebGL無効、JavaScript無効で内容が読めることを確認する。
- キーボード操作、フォーカス表示、横スクロールなし、コンソールの未処理エラーなしを確認する。

## Out of scope

- 参照サイトのコード、音源、画像、映像、フォントの流用
- 添付画像そのもの、切り抜き、加工、トレースの掲載
- 本格的なNavier–Stokes流体シミュレーション
- 新しい実在作品、クライアント実績、受賞歴の追加
- CMS、問い合わせバックエンド、アクセス解析
- 外部ライブラリ、CDN、リモートフォント、ビルド工程
- 自動再生や音声ファイルの追加
