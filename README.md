# web-tool

## 開発環境
```
・vue.js
・typescript
・apollo-graphql
・vuex / flux
・bootstrap-vue
```
## 説明
```
社内や団体で共通的に必要な各種ツールを
ネットですぐ使える・見えるようにする。
```
## 要件定義：会員管理
```
・ログインプロセス
　→ 会員登録
　→ 会員ログイン
・会員情報見る
　→ 写真・名前・フリガな・内線・email・
・座席表
　→ 座席配置図作成
　→ 座席配置図に基づいた各会員の座席を表示
　→ 各会員の座席管理
　→ 座席押下時、会員情報を表示
・アンケート
　→ 匿名投稿可
　→ 投稿機関設定
　→ いいね
　→ 結果エキスポート
```
## 要件定義：各種ツール
```
・文字列変換
　→ base64
　→ 臨時パスワード生成（桁数指定・小文字、大文字、数字、記号含む）
・json parser  
　→ http://json.parser.online.fr
```

## Project setup
```
npm install
```
### Compiles and hot-reloads for development
```
npm run serve
```
### Compiles and minifies for production
```
npm run build
```
### Run your tests
```
npm run test
```
### Lints and fixes files
```
npm run lint
```
### Run your unit tests
```
npm run test:unit
```
### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
