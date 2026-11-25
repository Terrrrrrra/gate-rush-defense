# Gate Rush Defense

Three.js 로 만든 **세로형 3D 모바일 하이퍼캐주얼 디펜스 게임**입니다.
게임 엔진 없이 순수 웹 기술(Three.js + Vite + HTML/CSS)만 사용하며, GitHub Pages 에 정적 파일로 배포되어 스마트폰 브라우저에서 바로 플레이할 수 있습니다.

## 게임 방법

| 조작 | 모바일 | PC |
| --- | --- | --- |
| 대포 이동 + 발사 | 화면을 누른 채 좌우 드래그 | 마우스 클릭 후 좌우 드래그 / ←→, A·D |
| 파워샷 (에너지 100%) | POWER 버튼 | POWER 버튼 / Space |

1. 하단의 파란 대포가 병력을 발사합니다.
2. 병력이 **x2 · x3 · x5 · x7 게이트**를 통과하면 그 배율만큼 늘어납니다. (같은 게이트는 1번만 적용)
3. 증식된 병력이 상단의 **빨강/보라 기지**를 공격합니다. 기지에서 나온 적 병력과 부딪히면 1:1로 소멸합니다.
4. 두 기지를 모두 파괴하면 **승리**, 적 병력이 대포 라인을 넘어 플레이어 체력이 0이 되면 **패배**입니다.

## 로컬 실행

```bash
npm install
npm run dev        # http://localhost:5173 (같은 Wi-Fi 의 휴대폰에서는 표시되는 Network 주소로 접속)
npm run build      # dist/ 에 배포용 빌드
npm run preview    # 빌드 결과 미리보기 (서비스 워커 동작 확인용)
```

- `?debug` 를 URL 에 붙이거나 점수판을 더블클릭하면 FPS 가 표시됩니다.
- 콘솔에서 `window.__game` 으로 게임 인스턴스에 접근할 수 있습니다.

## GitHub Pages 배포

1. GitHub 에 새 저장소를 만들고 이 프로젝트를 push 합니다.
   ```bash
   git init
   git add .
   git commit -m "Gate Rush Defense"
   git branch -M main
   git remote add origin https://github.com/<사용자명>/<저장소명>.git
   git push -u origin main
   ```
2. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 설정합니다.
3. 이후 `main`(또는 `master`) 브랜치에 push 할 때마다 `.github/workflows/deploy.yml` 이 자동으로 빌드·배포합니다.
4. 배포 주소: `https://<사용자명>.github.io/<저장소명>/`

### 경로 처리 방식

- 워크플로가 저장소 이름을 읽어 `BASE_PATH=/<저장소명>/` 을 설정하고, `vite.config.js` 가 이를 `base` 로 사용합니다.
  (`<사용자명>.github.io` 저장소면 `/`)
- 로컬에서는 `base: './'`(상대 경로)라 어느 하위 경로에서도 동작합니다.
- 단일 페이지라 라우터가 없고, `404.html` 을 `index.html` 복사본으로 두어 어떤 경로에서 새로고침해도 게임이 열립니다.
- 별도 백엔드 없이 정적 파일만으로 실행됩니다.

## PWA

- `public/manifest.webmanifest` (상대 경로 `start_url`/`scope`) + 아이콘(192/512/maskable/apple-touch)
- `public/sw.js` 서비스 워커: 프로덕션 빌드에서만 `BASE_URL` 기준으로 등록됩니다.
  - HTML: network-first (오프라인 시 캐시)
  - 해시 빌드 에셋: cache-first
  - 기타: stale-while-revalidate
- 휴대폰 브라우저 메뉴의 **홈 화면에 추가**로 앱처럼 전체 화면 실행이 가능합니다. (HTTPS 필요 — GitHub Pages 는 기본 HTTPS)
- 아이콘은 `npm run icons` 로 다시 생성할 수 있습니다 (의존성 없는 Node 스크립트).

## 프로젝트 구조

```
src/
  main.js                  진입점, 서비스 워커 등록
  style.css                반응형 UI (vw/vh/clamp, safe-area)
  game/
    Game.js                컴포지션 루트, 메인 루프(rAF, deltaTime), 품질 전환, 탭 비활성 처리
    GameManager.js         상태(타이틀/진행/일시정지/승리/패배), 점수·에너지·체력, 이벤트 연출
    GameConfig.js          밸런스·카메라·품질 프리셋
    LevelData.js           게이트/기지 배치 데이터 (여기만 고치면 레벨 수정)
  scene/
    SceneManager.js        렌더러, 픽셀비 상한, 리사이즈
    CameraManager.js       화면비에 맞춘 쿼터뷰 카메라, 화면 흔들림
    Lighting.js            Hemisphere + Directional(그림자)
    MapBuilder.js          InstancedMesh 타일 바닥, 난간, 나무/바위
  entities/
    PlayerCannon.js        대포 모델/이동/반동
    UnitManager.js         병력 시뮬레이션 (SoA TypedArray, 공간 그리드 군집 분리, 충돌)
    UnitRenderer.js        InstancedMesh 3개로 모든 병력 렌더링 (행렬 직접 기록)
    Gate.js                게이트 종류(GATE_TYPES), 게이트 모델, 통과 판정/증식
    EnemyBase.js           기지 종류(BASE_KINDS), 체력, 피격/파괴 연출, 적 생성
  systems/
    InputSystem.js         Pointer Events 통합 입력 + 키보드
    CombatSystem.js        목표 선택, 기지 공격, 적 돌파 판정
    ParticleSystem.js      InstancedMesh 파티클 + 충격파 링 풀
    ObjectPool.js          범용 오브젝트 풀
  ui/
    UIManager.js           HUD, 월드 좌표 팝업, 결과 화면
  utils/
    MathUtils.js, PerformanceMonitor.js
```

## 확장 방법

- **게이트 추가/수정**: `src/game/LevelData.js` 의 `gates` 배열에 `{ type, value, x, z, width, move? }` 추가.
  새로운 게이트 동작은 `src/entities/Gate.js` 의 `GATE_TYPES` 에 정의 (예: `add` 타입 포함).
- **기지 추가**: `LevelData.js` 의 `bases` 에 항목 추가 (색상, 체력, 적 생성 주기/수/속도). 새로운 외형은 `EnemyBase.js` 의 `BASE_KINDS` 에 빌더 함수 추가.
- **밸런스**: `src/game/GameConfig.js`.

## 성능 설계

- 병력은 개별 Mesh 가 아닌 **InstancedMesh**(몸통 1 + 다리 1)로 그리며, 위치/회전/스케일을 `instanceMatrix` 배열에 직접 기록합니다.
- 병력 데이터는 고정 크기 TypedArray(SoA)에 저장하고, 사망 시 swap-remove 로 압축 → 프레임마다 객체 할당이 없습니다.
- 이웃 탐색은 공간 해시 그리드(연결 리스트)로 O(n) 에 가깝게 처리합니다. 물리 엔진/Rigidbody 를 사용하지 않습니다.
- 파티클, 팝업 텍스트, 충격파 링은 모두 풀링합니다. 지오메트리/머티리얼은 공유합니다.
- 품질 프리셋(낮음/보통/높음): 픽셀비 상한, 그림자 해상도, 최대 병력 수, 파티클 수, 병력 그림자.
  FPS 가 계속 낮으면 자동으로 한 단계 낮춥니다. 탭이 숨겨지면 루프를 멈추고 게임을 일시정지합니다.
