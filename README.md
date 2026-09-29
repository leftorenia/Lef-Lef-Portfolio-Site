# LEFLEF Portfolio

ShaderとリアルタイムVFXを探究する、れふれふの個人ポートフォリオサイトです。

公開URL: https://leftorenia.github.io/Lef-Lef-Portfolio-Site/index.html

## Pages

- `index.html` — Profile。活動の紹介と現在の探究領域
- `works.html` — Works。制作したVFXとShader表現の記録
- `contact.html` — Contact。メールと各SNSへのリンク

旧 `about.html` は、Profileを兼ねる `index.html` へ転送します。

## Design and implementation

黒を基調に紫・青・淡い白の光を重ねた「Silent Cosmos」をテーマにしています。背景の星、星座線、ネビュラ、流星とWorksのビジュアルは、CSSおよびCanvas 2Dで生成します。外部ライブラリ、CDN、リモートフォント、ビルド工程はありません。

デザイン検討に使った参考画像はリポジトリや公開サイトへ含めず、画像の切り抜き・加工・トレースも使用していません。

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

テストではページ構成、リンク、生成エフェクトの密度制御、Canvas非対応時の挙動、ローカル素材の解決、画像ファイルを含めない方針を確認します。

## Adding a work

作品を追加するときは、次の順序で更新します。

1. `works.html` にある `COMING SOON` のカードを1枚選び、既存のW.001と同じリンク付き作品カードへ置き換えます。
2. `works/cosmo-effects/index.html` を新しい `works/<slug>/index.html` へコピーし、作品ごとの詳細ページを作ります。
3. タイトル、種別、説明、使用技術、メタ情報を、確認できている内容だけに更新します。
4. `npm test` を実行したあとローカルプレビューを開き、一覧・詳細・戻り先のリンクと各画面幅での表示を確認します。

作品情報は静的HTMLへ記述し、JavaScriptやCanvasが利用できない場合もタイトル、説明、技術情報を読める状態を維持します。

## Motion and accessibility

OSやブラウザで `prefers-reduced-motion: reduce` が有効な場合、Canvasはアニメーションループを開始せず、静止した宇宙表現を一度だけ描画します。本文とナビゲーションはJavaScriptが無効でも利用できます。
