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

デザイン検討に使った参考画像と参照サイトのコード・画像・音源・フォントなどの素材はリポジトリや公開サイトへ含めず、それらの切り抜き・加工・トレースも使用していません。ユーザー提供のプロフィールアイコン `assets/images/lef-lef-avatar.png` と、掲載許可のある作品画像を `assets/images/works/<slug>/` 配下でのみ使用します。作品画像は表示品質を保ちながらWeb向けに縮小・圧縮し、寸法と代替テキストをHTMLへ記載します。現在のサイトには環境音や自動再生される音声はありません。

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

テストではページ構成、描画品質、低モーション、WebGL2非対応時の挙動を確認します。公開HTMLの全href/src、相対ES module import、CSS素材参照を再帰的に検査し、GitHub Pagesの `/Lef-Lef-Portfolio-Site/` 配下で解決すること、リモートコード・フォント・メディアやルート相対素材がないことを確認します。ラスター画像は承認済みプロフィールアイコンと `assets/images/works/<slug>/` 配下の作品画像だけを許可し、音声ファイルは許可しません。

公開前は `git diff --check` も実行し、Profile、Works、Contact、作品詳細を1440×1000、900×1000、390×844で確認します。横スクロール、フォーカス、低モーション、WebGL無効時、コンソールエラーを点検してください。

## Adding a work

作品を追加するときは、次の順序で更新します。

1. `works/cosmo-effects/index.html` を新しい `works/<slug>/index.html` へコピーし、作品ごとの詳細ページを作ります。
2. 掲載許可のある画像をWeb向けに最適化し、`assets/images/works/<slug>/` へ保存します。
3. `works.html` の作品一覧の先頭へリンク付き作品カードを追加します。公開作品は新しい順で並べ、最新作が常に左上に来るようにします。
4. タイトル、種別、説明、使用技術、メタ情報を、確認できている内容だけに更新し、`tests/site-structure.test.mjs` の作品順と詳細ページの期待値も更新します。
5. `npm test` を実行したあとローカルプレビューを開き、一覧・詳細・戻り先のリンクと各画面幅での表示を確認します。

作品情報は静的HTMLへ記述し、JavaScriptやCanvasが利用できない場合もタイトル、説明、技術情報を読める状態を維持します。

## Motion and accessibility

OSやブラウザで `prefers-reduced-motion: reduce` が有効な場合、CanvasはRAFアニメーションループを開始せず、静的な月夜を描画します。背景は起動・リサイズ・設定変更時に再描画し、軌跡や瞬きは止まります。通常時もタブ非表示でアニメーションを停止します。

キーボードフォーカスは月光色のアウトラインで示します。背景Canvasは`aria-hidden`かつポインター操作を透過します。本文、ナビゲーション、連絡先、作品情報は静的HTMLなので、JavaScriptが無効でも利用できます。
