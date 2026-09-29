# LEFLEF Portfolio

ShaderとリアルタイムVFXを探究する、れふれふの個人ポートフォリオサイトです。

公開URL: https://leftorenia.github.io/Lef-Lef-Portfolio-Site/index.html

## Pages

- `index.html` — Profile。活動の紹介と現在の探究領域
- `works.html` — Works。制作したVFXとShader表現の記録
- `contact.html` — Contact。メールと各SNSへのリンク

旧 `about.html` は、Profileを兼ねる `index.html` へ転送します。

## Design and implementation

青い雲、星、細い三日月で静かな月夜を描く「Lunar Reverie」をテーマにしています。共通背景はWebGL2の単一Canvasと生成シェーダー、Worksの作品プレビューはCanvas 2Dで描画します。外部ライブラリ、CDN、リモートフォント、ビルド工程はありません。

背景はHigh / Medium / Lowの3段階で、内部描画倍率は0.75 / 0.625 / 0.5、雲ノイズは4 / 3 / 2オクターブ、軌跡は12 / 8 / 4点です。初期品質はデスクトップHigh、モバイルMedium。DPRは最大1.5（モバイルとLowでは1.0）で、直近90フレームの平均フレーム時間が22msを超えると一段階下げ、計測窓をリセットします。同一ページ内で自動的には上げません。WebGL2が利用できない場合やコンテキスト喪失時は、CSSの静的な月夜へフォールバックします。

ポインターやタッチ移動で雲が反応し、軌跡は約2.5秒で消えます。入力はスクロールやリンク操作を妨げません。Profileは雲と月を強く、Worksは控えめに、Contactは雲の変位を止めて星の増光だけにし、詳細ページは月を消して作品を引き立てます。

デザイン検討に使った参考画像と参照サイトのコード・画像・音源・フォントなどの素材はリポジトリや公開サイトへ含めず、それらの切り抜き・加工・トレースも使用していません。ユーザー提供のプロフィールアイコン `assets/images/lef-lef-avatar.png` だけをローカルのラスター画像として使用し、CSSで円形に表示しています。音声ファイルは追加しません。

## Optional sound

Web Audio APIで柔らかなパッド、フィルターを通した風、低頻度のベルを生成します。音声ファイルは使いません。初期状態は `SOUND OFF` で、利用者の明示操作でのみAudioContextを生成・再開します。ON/OFFは約1秒でフェードし、同一ページの切替では既存ノードを再利用します。出力は小さく設定し、最終段のコンプレッサーでピークを抑えます。

- `SOUND OFF`: 希望状態がOff。
- `START SOUND`: 保存状態はOnでも、ページロード後・タブ復帰後は再び開始操作が必要。
- `SOUND ON`: 実際に再生中。`aria-pressed="true"`。
- `SOUND UNAVAILABLE`: Web Audio非対応などで利用不可。ボタンを無効化。

希望状態だけを `lef-lef-portfolio:ambient-enabled` キーへ保存します。保存が拒否されても現在ページの操作は可能です。タブが非表示になるとフェード後に音とベルのスケジューラーを停止し、復帰しても自動再生しません。一時的な開始拒否は `START SOUND` から再試行できます。

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

テストではページ構成、音声の4状態とライフサイクル、描画品質、低モーション、WebGL2非対応時の挙動を確認します。公開HTMLの全href/src、相対ES module import、CSS素材参照を再帰的に検査し、GitHub Pagesの `/Lef-Lef-Portfolio-Site/` 配下で解決すること、リモートコード・フォント・メディアやルート相対素材、承認済みプロフィールアイコン以外の画像・音声ファイルがないことを確認します。

公開前は `git diff --check` も実行し、Profile、Works、Contact、作品詳細を1440×1000、900×1000、390×844で確認します。横スクロール、フォーカス、Sound操作、低モーション、WebGL無効時、コンソールエラーを点検してください。

## Adding a work

作品を追加するときは、次の順序で更新します。

1. `works.html` にある `COMING SOON` のカードを1枚選び、既存のW.001と同じリンク付き作品カードへ置き換えます。
2. `works/cosmo-effects/index.html` を新しい `works/<slug>/index.html` へコピーし、作品ごとの詳細ページを作ります。
3. タイトル、種別、説明、使用技術、メタ情報を、確認できている内容だけに更新します。実作品とComing Soonの内訳が変わるため、`tests/site-structure.test.mjs` のカード数の期待値も更新します。
4. `npm test` を実行したあとローカルプレビューを開き、一覧・詳細・戻り先のリンクと各画面幅での表示を確認します。

作品情報は静的HTMLへ記述し、JavaScriptやCanvasが利用できない場合もタイトル、説明、技術情報を読める状態を維持します。

## Motion and accessibility

OSやブラウザで `prefers-reduced-motion: reduce` が有効な場合、CanvasはRAFアニメーションループを開始せず、静的な月夜を描画します。背景は起動・リサイズ・設定変更時に再描画し、軌跡や瞬きは止まります。通常時もタブ非表示でアニメーションを停止します。動きの設定とSoundの選択は独立しています。

キーボードフォーカスは月光色のアウトラインで示し、Sound状態をテキストと`aria-pressed`で伝えます。背景Canvasは`aria-hidden`かつポインター操作を透過します。本文、ナビゲーション、連絡先、作品情報は静的HTMLなので、JavaScriptが無効でも利用できます。
