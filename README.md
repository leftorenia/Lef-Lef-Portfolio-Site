# LEFLEF Portfolio

ShaderとリアルタイムVFXを探究する、れふれふの個人ポートフォリオサイトです。

公開URL: https://leftorenia.github.io/Lef-Lef-Portfolio-Site/index.html

## Pages

- `index.html` — Profile。活動の紹介と現在の探究領域
- `works.html` — Works。制作したVFXとShader表現の記録
- `contact.html` — Contact。メールと各SNSへのリンク

旧 `about.html` は、Profileを兼ねる `index.html` へ転送します。

## Design and implementation

青い雲、星、細い三日月で静かな月夜を描く「Lunar Reverie」をテーマにしています。共通背景はWebGL2の単一Canvasと生成シェーダーで描画し、Worksでは作品ごとのローカル画像またはCanvas 2Dプレビューを使用します。外部ライブラリ、CDN、リモートフォント、ビルド工程はありません。

背景はHigh / Medium / Lowの3段階で、内部描画倍率は0.75 / 0.625 / 0.5、雲ノイズは4 / 3 / 2オクターブ、軌跡は12 / 8 / 4点です。初期品質はデスクトップHigh、モバイルMedium。DPRは最大1.5（モバイルとLowでは1.0）で、直近90フレームの平均フレーム時間が22msを超えると一段階下げ、計測窓をリセットします。同一ページ内で自動的には上げません。WebGL2が利用できない場合やコンテキスト喪失時は、CSSの静的な月夜へフォールバックします。

ポインターやタッチ移動で雲が反応し、軌跡は約2秒で消えます。入力はスクロールやリンク操作を妨げません。Profileは雲と月を強く、Worksは控えめに、Contactは雲の変位を止めて星の増光だけにし、詳細ページは月を消して作品を引き立てます。

デザイン検討に使った参考画像と参照サイトのコード・画像・音源・フォントなどの素材はリポジトリや公開サイトへ含めず、それらの切り抜き・加工・トレースも使用していません。ユーザー提供のプロフィールアイコン `assets/images/lef-lef-avatar.png` と、掲載許可のある作品画像を `assets/images/works/<slug>/` 配下で使用します。CONNECTのVRChatとSpeaker Deckには、ユーザー指定に基づき公式サイト由来のロゴを `assets/images/platforms/` 配下へ保存し、形・色・縦横比を変えずに使用します。出典は同フォルダーのREADMEに記載しています。作品画像は表示品質を保ちながらWeb向けに縮小・圧縮し、寸法と代替テキストをHTMLへ記載します。現在のサイトには環境音や自動再生される音声はありません。

## Local preview

リポジトリ直下で静的サーバーを起動します。

```sh
python -m http.server 4173
```

ブラウザで `http://localhost:4173/index.html` を開いて確認できます。

## Verification

Node.jsの組み込みテストランナーだけを使用します。依存パッケージのインストールは不要です。

```sh
npm test
```

テストではページ構成、描画品質、低モーション、WebGL2非対応時の挙動を確認します。公開HTMLの全href/src、相対ES module import、CSS素材参照を再帰的に検査し、GitHub Pagesの `/Lef-Lef-Portfolio-Site/` 配下で解決すること、リモートコード・フォント・メディアやルート相対素材がないことを確認します。ラスター画像は承認済みプロフィールアイコン、公式VRChatロゴ `assets/images/platforms/vrchat.png`、`assets/images/works/<slug>/` 配下の作品画像だけを許可し、音声ファイルは許可しません。

作品動画は例外として、明示的に設定した動画URLのみ使用します。YouTube/Vimeoは公式プレーヤーへ埋め込み、HTTPSのMP4/WebMは直接再生します。ローカルのMP4/WebMは `assets/videos/works/<slug>/` 配下のみ許可します。環境音や動画の自動再生は追加しません。

公開前は `git diff --check` も実行し、Profile、Works、Contact、作品詳細を1440×1000、900×1000、390×844で確認します。横スクロール、フォーカス、低モーション、WebGL無効時、コンソールエラーを点検してください。

## Adding a work

現在のIMMERSNAPと同じレイアウトを使うコピー用ファイルを用意しています。新しい詳細ページは `works/<slug>/index.html` に置きます。既存作品のHTMLを書き換える必要はありません。

- [詳細ページのテンプレート](docs/templates/work-detail.html) — ページ全体をコピーするファイル
- [一覧カードのテンプレート](docs/templates/work-card.html) — `works.html` に貼り付けるHTML断片

### Copy and replace

1. 作品のフォルダー名（slug）を決めます。小文字の英数字とハイフンを使い、既存作品と重複させません。例: `new-work`。
2. `works/new-work/` を作り、`docs/templates/work-detail.html` をその中へ `index.html` という名前でコピーします。テンプレート自体はコピー元として残してください。
3. 掲載許可のある画像をWeb向けに最適化して、`assets/images/works/new-work/` に `cover.jpg`、`detail-01.jpg`、`detail-02.jpg` として保存します。別の名前や拡張子を使う場合はHTMLの `src` も変更します。
4. `docs/templates/work-card.html` の内容を、`works.html` の `<section class="works-grid" aria-label="作品一覧">` の直後へ貼り付けます。新しいカードが先頭・左上になります。
5. コピー先の詳細ページと貼り付けたカードの `{{...}}` を、下の一覧に沿ってすべて置き換えます。同じ項目は両方で同じ内容にします。
6. 必要に応じて説明の `span`、画像の `figure`、使用技術の `li` をコピーまたは削除します。動画がある場合だけ `data-work-video-url=""` にURLを記入します。動画がなければ空欄のままで構いません。
7. `npm test` と `git diff --check` を実行し、ローカルプレビューで一覧・詳細・戻り先のリンクと各画面幅の表示を確認します。通常の作品追加ではテストの件数や作品順を書き直す必要はありません。

| 置き換える項目 | 内容 |
| --- | --- |
| `{{SLUG}}` | フォルダー名。上の例なら `new-work` |
| `{{TITLE}}` / `{{CATEGORY}}` / `{{SUMMARY}}` | 作品名 / 種別 / 一覧と検索用の短い説明 |
| `{{WORK_NUMBER}}` | 一覧の最新番号に1を加えた番号。現在の次は `W.003` |
| `{{CATCHPHRASE_LINE_1}}` / `{{CATCHPHRASE_LINE_2}}` | 表紙の下に載せるキャッチフレーズ。1行なら `<br>` と2行目を削除 |
| `{{DESCRIPTION_LINE_1}}` 〜 `{{DESCRIPTION_LINE_4}}` | キャッチフレーズ下の補足説明。3〜5行を目安に調整 |
| `{{COVER_WIDTH}}` / `{{COVER_HEIGHT}}` / `{{COVER_ALT}}` | 表紙の実寸と画像の説明 |
| `{{IMAGE_01_WIDTH}}` / `{{IMAGE_01_HEIGHT}}` / `{{IMAGE_01_ALT}}` / `{{IMAGE_01_CAPTION}}` | 1枚目の詳細画像の実寸・説明・キャプション。2枚目は `IMAGE_02_...` |
| `{{TECHNOLOGY_1}}` / `{{TECHNOLOGY_2}}` | 使用技術。一覧と詳細の `li` を同じ内容で追加・削除 |

`{{...}}` は自動変換される変数ではなく、手動で置き換える目印です。コピー元には残し、公開するHTMLには残さないでください。実寸は数値のみ（例: `1920`）、説明やタイトルに `&`・`<`・`"` を含める場合は、それぞれ `&amp;`・`&lt;`・`&quot;` と記入します。

作品情報は静的HTMLへ記述し、JavaScriptやCanvasが利用できない場合もタイトル、説明、技術情報を読める状態を維持します。

詳細ページのヘッダーは作品名のみとし、番号・分類・英字サブタイトル・タイトル脇の説明文を置きません。番号と分類は作品一覧のカードだけで表示し、作品の説明はサムネイル以降の本文にまとめます。

### Detail images and video

画像欄の見出しは作品の種類によらず `DETAILS` を使い、小さな英字ラベルは付けません。テンプレートでも、この見出しはそのまま使用できます。

表紙の下に掲載する画像は `.work-gallery` 内の `.work-gallery-item` に追加します。すべて同じ幅の2列組みで、719px以下では1列になります。画像は16:9のフレーム内に `object-fit: contain` で収めるため、元の比率が異なる場合も切り抜き・引き伸ばしをせず、余白で調整します。HTMLの `width` / `height` は画像の実寸を記載してください。

IMMERSNAPを基準とするテンプレートは「表紙 → キャッチフレーズ・説明文 → DETAILS見出し → 動画 → 画像」の順です。動画欄は `.work-gallery-section` 内の見出し直後、画像グリッドの前にある `.work-video-section` です。`data-work-video-url=""` にURLまたはファイルパスを指定すると、全幅の16:9プレーヤーを表示します。空欄の場合はセクション全体を非表示にし、余白も残しません。`data-work-video-title` には作品名を含む動画タイトルを設定します。旧構成のCOSMO EFFECTSはDETAILS画像欄がなく、動画欄は従来どおり表紙直下です。

- YouTube: 通常の `https://www.youtube.com/watch?v=VIDEO_ID`、`https://youtu.be/VIDEO_ID`、Shorts・live・埋め込みURLに対応します。共有パラメーターや自動再生指定は引き継ぎません。[公式のプライバシー強化モード](https://support.google.com/youtube/answer/171780)の `youtube-nocookie.com` プレーヤーを使用します。
- Vimeo: `https://vimeo.com/VIDEO_ID` または公式プレーヤーURLを使用します。限定公開動画では末尾のハッシュまたは `h` パラメーターを維持します。[Vimeo公式の限定公開動画案内](https://help.vimeo.com/hc/en-us/articles/12426470858001-Embedded-player-displays-This-video-does-not-exist-message)を参照してください。
- 動画素材: `assets/videos/works/<slug>/demo.mp4`（またはWebM）へ保存し、詳細ページからは `../../assets/videos/works/<slug>/demo.mp4` を指定します。HTTPSで配信するMP4/WebMの直接URLも使用できます。
- その他の動画サイト: 安全なHTTPSのURLは元サイトへのリンクとして表示し、任意のページをiframeへ埋め込みません。別サイトの埋め込み対応が必要になった際は、その公式方式を追加してください。

どの方式でも自動再生・ループは行わず、元動画を開くリンクをプレーヤーの下に残します。投稿元の埋め込み禁止・限定公開設定・動画削除等はサイト側で回避できません。現在は動画URL未指定のため、実際の動画欄は表示されません。動画欄の初期化にはJavaScriptが必要ですが、作品の本文と画像はJavaScriptなしでも表示されます。

## Motion and accessibility

OSやブラウザで `prefers-reduced-motion: reduce` が有効な場合、CanvasはRAFアニメーションループを開始せず、静的な月夜を描画します。背景は起動・リサイズ・設定変更時に再描画し、軌跡や瞬きは止まります。通常時もタブ非表示でアニメーションを停止します。

キーボードフォーカスは月光色のアウトラインで示します。背景Canvasは`aria-hidden`かつポインター操作を透過します。本文、ナビゲーション、連絡先、作品情報は静的HTMLなので、JavaScriptが無効でも利用できます。
