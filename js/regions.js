(() => {
  "use strict";

  // 첨부한 법정동코드 목록의 '존재' 지역 기준.
  // API에는 법정동코드 앞 5자리를 전달합니다.
  // 구가 있는 시는 시 전체 대신 각 구를 선택합니다.

  const regions = [
    {
      code: "11",
      name: "서울특별시",
      districts: `
11110 종로구
11140 중구
11170 용산구
11200 성동구
11215 광진구
11230 동대문구
11260 중랑구
11290 성북구
11305 강북구
11320 도봉구
11350 노원구
11380 은평구
11410 서대문구
11440 마포구
11470 양천구
11500 강서구
11530 구로구
11545 금천구
11560 영등포구
11590 동작구
11620 관악구
11650 서초구
11680 강남구
11710 송파구
11740 강동구
      `
    },
    {
      code: "12",
      name: "전남광주통합특별시",
      districts: `
12110 목포시
12130 여수시
12150 순천시
12170 나주시
12190 광양시
12210 동구
12240 서구
12270 남구
12300 북구
12330 광산구
12710 담양군
12720 곡성군
12730 구례군
12740 고흥군
12750 보성군
12760 화순군
12770 장흥군
12780 강진군
12790 해남군
12800 영암군
12810 무안군
12820 함평군
12830 영광군
12840 장성군
12850 완도군
12860 진도군
12870 신안군
      `
    },
    {
      code: "26",
      name: "부산광역시",
      districts: `
26110 중구
26140 서구
26170 동구
26200 영도구
26230 부산진구
26260 동래구
26290 남구
26320 북구
26350 해운대구
26380 사하구
26410 금정구
26440 강서구
26470 연제구
26500 수영구
26530 사상구
26710 기장군
      `
    },
    {
      code: "27",
      name: "대구광역시",
      districts: `
27110 중구
27140 동구
27170 서구
27200 남구
27230 북구
27260 수성구
27290 달서구
27710 달성군
27720 군위군
      `
    },
    {
      code: "28",
      name: "인천광역시",
      districts: `
28125 제물포구
28155 영종구
28177 미추홀구
28185 연수구
28200 남동구
28237 부평구
28245 계양구
28275 서해구
28290 검단구
28710 강화군
28720 옹진군
      `
    },
    {
      code: "30",
      name: "대전광역시",
      districts: `
30110 동구
30140 중구
30170 서구
30200 유성구
30230 대덕구
      `
    },
    {
      code: "31",
      name: "울산광역시",
      districts: `
31110 중구
31140 남구
31170 동구
31200 북구
31710 울주군
      `
    },
    {
      code: "36",
      name: "세종특별자치시",
      districts: `
36110 세종특별자치시
      `
    },
    {
      code: "41",
      name: "경기도",
      districts: `
41111 수원시 장안구
41113 수원시 권선구
41115 수원시 팔달구
41117 수원시 영통구
41131 성남시 수정구
41133 성남시 중원구
41135 성남시 분당구
41150 의정부시
41171 안양시 만안구
41173 안양시 동안구
41192 부천시 원미구
41194 부천시 소사구
41196 부천시 오정구
41210 광명시
41220 평택시
41250 동두천시
41271 안산시 상록구
41273 안산시 단원구
41281 고양시 덕양구
41285 고양시 일산동구
41287 고양시 일산서구
41290 과천시
41310 구리시
41360 남양주시
41370 오산시
41390 시흥시
41410 군포시
41430 의왕시
41450 하남시
41461 용인시 처인구
41463 용인시 기흥구
41465 용인시 수지구
41480 파주시
41500 이천시
41550 안성시
41570 김포시
41591 화성시 만세구
41593 화성시 효행구
41595 화성시 병점구
41597 화성시 동탄구
41610 광주시
41630 양주시
41650 포천시
41670 여주시
41800 연천군
41820 가평군
41830 양평군
      `
    },
    {
      code: "43",
      name: "충청북도",
      districts: `
43111 청주시 상당구
43112 청주시 서원구
43113 청주시 흥덕구
43114 청주시 청원구
43130 충주시
43150 제천시
43720 보은군
43730 옥천군
43740 영동군
43745 증평군
43750 진천군
43760 괴산군
43770 음성군
43800 단양군
      `
    },
    {
      code: "44",
      name: "충청남도",
      districts: `
44131 천안시 동남구
44133 천안시 서북구
44150 공주시
44180 보령시
44200 아산시
44210 서산시
44230 논산시
44250 계룡시
44270 당진시
44710 금산군
44760 부여군
44770 서천군
44790 청양군
44800 홍성군
44810 예산군
44825 태안군
      `
    },
    {
      code: "47",
      name: "경상북도",
      districts: `
47111 포항시 남구
47113 포항시 북구
47130 경주시
47150 김천시
47170 안동시
47190 구미시
47210 영주시
47230 영천시
47250 상주시
47280 문경시
47290 경산시
47730 의성군
47750 청송군
47760 영양군
47770 영덕군
47820 청도군
47830 고령군
47840 성주군
47850 칠곡군
47900 예천군
47920 봉화군
47930 울진군
47940 울릉군
      `
    },
    {
      code: "48",
      name: "경상남도",
      districts: `
48121 창원시 의창구
48123 창원시 성산구
48125 창원시 마산합포구
48127 창원시 마산회원구
48129 창원시 진해구
48170 진주시
48220 통영시
48240 사천시
48250 김해시
48270 밀양시
48310 거제시
48330 양산시
48720 의령군
48730 함안군
48740 창녕군
48820 고성군
48840 남해군
48850 하동군
48860 산청군
48870 함양군
48880 거창군
48890 합천군
      `
    },
    {
      code: "50",
      name: "제주특별자치도",
      districts: `
50110 제주시
50130 서귀포시
      `
    },
    {
      code: "51",
      name: "강원특별자치도",
      districts: `
51110 춘천시
51130 원주시
51150 강릉시
51170 동해시
51190 태백시
51210 속초시
51230 삼척시
51720 홍천군
51730 횡성군
51750 영월군
51760 평창군
51770 정선군
51780 철원군
51790 화천군
51800 양구군
51810 인제군
51820 고성군
51830 양양군
      `
    },
    {
      code: "52",
      name: "전북특별자치도",
      districts: `
52111 전주시 완산구
52113 전주시 덕진구
52130 군산시
52140 익산시
52180 정읍시
52190 남원시
52210 김제시
52710 완주군
52720 진안군
52730 무주군
52740 장수군
52750 임실군
52770 순창군
52790 고창군
52800 부안군
      `
    }
  ];

  const STORAGE_KEY = "aptick.regionSelection.v1";

  function readSelection() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return null;
    }
  }

  function initializeRegions() {
    const sidoSelect = document.getElementById("sidoSelect");
    const districtSelect = document.getElementById("sigunguSelect");

    if (!sidoSelect || !districtSelect) {
      return;
    }

    // 文字列の地域一覧をオブジェクトへ変換
    const regionList = regions.map(region => {
      const districts = region.districts
        .trim()
        .split("\n")
        .map(line => {
          const text = line.trim();

          return {
            code: text.slice(0, 5),
            name: text.slice(6).trim()
          };
        });

      return {
        code: region.code,
        name: region.name,
        districts: districts
      };
    });

    function saveSelection() {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            sido: sidoSelect.value,
            district: districtSelect.value
          })
        );
      } catch (error) {
        // 저장할 수 없어도 지역 선택과 조회는 계속 사용
      }
    }

    function renderDistricts(preferredCode) {
      const region = regionList.find(item => {
        return item.code === sidoSelect.value;
      });

      districtSelect.replaceChildren();

      if (!region) {
        districtSelect.disabled = true;
        return;
      }

      region.districts.forEach(district => {
        const option = document.createElement("option");

        option.value = district.code;
        option.textContent = district.name;

        districtSelect.appendChild(option);
      });

      districtSelect.disabled = false;

      const hasPreferred = region.districts.some(district => {
        return district.code === preferredCode;
      });

      if (hasPreferred) {
        districtSelect.value = preferredCode;
      }

      saveSelection();
    }

    const saved = readSelection();

    const initialSido =
      saved &&
      regionList.some(region => region.code === saved.sido)
        ? saved.sido
        : "11";

    const initialDistrict =
      saved && saved.sido === initialSido
        ? saved.district
        : "11710";

    sidoSelect.replaceChildren();

    regionList.forEach(region => {
      const option = document.createElement("option");

      option.value = region.code;
      option.textContent = region.name;

      sidoSelect.appendChild(option);
    });

    sidoSelect.value = initialSido;
    renderDistricts(initialDistrict);

    sidoSelect.addEventListener("change", () => {
      renderDistricts();

      // 기존 main.js의 지역 변경 처리에도 알림
      districtSelect.dispatchEvent(
        new Event("change", { bubbles: true })
      );

      const status = document.getElementById("loadStatus");

      if (status) {
        status.textContent =
          "지역이 변경되었습니다. 조회 버튼을 눌러 새 지역의 데이터를 불러오세요.";
      }
    });

    districtSelect.addEventListener("change", saveSelection);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeRegions);
  } else {
    initializeRegions();
  }
})();