# web-tool

## 개발환경
```
　・front : vue.js
　・back : linux, go, graphql
　・DB : levelDB
```
## 1차 요건정의
```
　1. 계정 로그인 프로세스	
　　※ 현재는 로그인따위 없어서 모두가 다 같은 화면을 보게 됨.
  　※ 각자 개인 설정 등을 저장할 수 있도록 간단한 인증시스템 필요
    로그인 처리 : ID는 mail의 local부분사용, P/W는ID+p
  
    
　2. 사내 excel문서 관리 기능 (import, export, GUI형식으로 표시, 수정하기 ...)
　　- 각자 개인의 정보 (현재 공개돼 있는 정보들 을 각자 각자)
　　　※ 첫 데이터 입력에 대해서만 excel임포트, 이후 가능하면 웹툴에서 파일DB에다 데이터 관리할수 있도록
　　　※ 운영쪽에서 계속 엑셀에다 관리하길 원하면 데이터 입력은 알아서 윗쪽에서 엑셀로 하고
　　　　　해당 엑셀 자동 임포트 스크립트 이용해서 보는쪽은 GUI로 볼수 있도록	
　　- 데스크넷의 사원 소개 사진 (특히 이름 검색, 메일검색)	
　　- 노미니케이션 남은수량
  
　3. 설문조사 페이지 (QWT에 대한 신기능 추가 의견, 회사 건의사항) 좋아요 누를수 있게
 
　4. 좌석표 (여기서 사람 클릭하면 개인 정보로 간다)
 
 
 ++ DB 구성
유저 항목 Table 
 : ID,Password,userName,email,phone,tel,seat:{floor(층수),seatID(고유ID)} , photoURL , Nomi : { total, used, [date] }

```



## 2차목표
```
　1. 문자열 변환	
　　- base64
　　- 임시 비밀번호 생성 (케타수 지정 가능, 영문 소/대 + 숫자 + 기호)
  
　2. json paraser (indenter -> http://json.parser.online.fr )
 
　3. 테스트 메일 보내는 기능
　　- 여러건 동시에 보내기
  
　4. 공유폴더 목록 및 파일 보기 및 다운로드	
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
