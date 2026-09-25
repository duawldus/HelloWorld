"""초기 마스터 데이터. 수정 후 DB 파일(bangguseok.db)을 지우고 서버를 재시작하면 반영된다."""

from app.features.gamification.rules import BadgeCondition
from app.features.ingredients.models import StorageType as S
from app.features.recipes.models import Cookware, Difficulty

# (이름, 아이콘) — [화면 0] 온보딩 순서대로
SEASONINGS = [
    ("간장", "🫙"),
    ("식용유", "🛢️"),
    ("소금", "🧂"),
    ("후추", "🌶️"),
    ("설탕", "🍬"),
    ("고추장", "🥫"),
    ("된장", "🥣"),
    ("참기름", "🫗"),
    ("고춧가루", "🌶️"),
    ("다진마늘", "🧄"),
    ("마요네즈", "🥚"),
    ("케첩", "🍅"),
]

# (이름, 아이콘, 보관, 소비기한(일), 기본수량, 단위, 자주쓰는재료)
PRESETS = [
    ("계란", "🥚", S.FRIDGE, 21, 10, "개", True),
    ("두부", "🧊", S.FRIDGE, 7, 1, "모", True),
    ("대파", "🌿", S.FRIDGE, 10, 1, "단", True),
    ("양파", "🧅", S.ROOM, 30, 2, "개", True),
    ("우유", "🥛", S.FRIDGE, 10, 1, "개", True),
    ("김치", "🥬", S.FRIDGE, 30, 1, "통", True),
    ("돼지고기", "🥩", S.FRIDGE, 4, 300, "g", True),
    ("스팸", "🥫", S.ROOM, 365, 1, "캔", True),
    ("감자", "🥔", S.ROOM, 30, 3, "개", False),
    ("당근", "🥕", S.FRIDGE, 21, 1, "개", False),
    ("애호박", "🥒", S.FRIDGE, 7, 1, "개", False),
    ("버섯", "🍄", S.FRIDGE, 5, 1, "팩", False),
    ("쪽파", "🌱", S.FRIDGE, 7, 1, "단", False),
    ("소시지", "🌭", S.FRIDGE, 14, 1, "봉", False),
    ("햄", "🍖", S.FRIDGE, 14, 1, "개", False),
    ("참치캔", "🐟", S.ROOM, 365, 1, "캔", False),
    ("닭가슴살", "🍗", S.FRIDGE, 3, 1, "팩", False),
    ("소고기", "🥩", S.FRIDGE, 3, 200, "g", False),
    ("냉동만두", "🥟", S.FREEZER, 180, 1, "봉", False),
    ("밥", "🍚", S.FREEZER, 30, 2, "공기", False),
    ("라면", "🍜", S.ROOM, 150, 1, "개", False),
    ("치즈", "🧀", S.FRIDGE, 30, 1, "봉", False),
    ("콩나물", "🌱", S.FRIDGE, 3, 1, "봉", False),
    ("어묵", "🍢", S.FRIDGE, 7, 1, "봉", False),
    ("떡", "🍡", S.FRIDGE, 5, 1, "봉", False),
    ("고추", "🌶️", S.FRIDGE, 10, 3, "개", False),
    ("마늘", "🧄", S.FRIDGE, 14, 1, "봉", False),
]

# 재료: (이름, 양, 양념여부, 선택여부, 대체재)
RECIPES = [
    {
        "title": "김치찌개",
        "cook_minutes": 25,
        "difficulty": Difficulty.EASY,
        "cookware": Cookware.POT,
        "ingredients": [
            ("김치", "1컵", False, False, []),
            ("두부", "1/2모", False, False, []),
            ("대파", "1/2대", False, True, ["쪽파", "양파"]),
            ("돼지고기", "100g", False, False, ["스팸", "참치캔"]),
            ("고춧가루", "1큰술", True, True, []),
            ("다진마늘", "1작은술", True, True, []),
        ],
        "steps": [
            "냄비에 돼지고기와 김치를 넣고 중불에서 3분간 볶아요.",
            "물 2컵을 붓고 고춧가루·다진마늘을 넣어 끓여요.",
            "끓어오르면 두부와 대파를 넣고 5분 더 끓이면 완성!",
        ],
    },
    {
        "title": "두부 계란부침",
        "cook_minutes": 15,
        "difficulty": Difficulty.EASY,
        "cookware": Cookware.ONE_PAN,
        "ingredients": [
            ("두부", "1모", False, False, []),
            ("계란", "2개", False, False, []),
            ("대파", "약간", False, False, ["쪽파", "양파"]),
            ("간장", "1큰술", True, False, []),
            ("식용유", "2큰술", True, False, []),
        ],
        "steps": [
            "두부를 1cm 두께로 썰고 키친타월로 물기를 제거해요.",
            "계란을 풀고 다진 대파를 섞어 계란물을 만들어요.",
            "두부에 계란물을 입혀 기름 두른 팬에 앞뒤로 노릇하게 부쳐요.",
        ],
    },
    {
        "title": "계란말이",
        "cook_minutes": 10,
        "difficulty": Difficulty.EASY,
        "cookware": Cookware.ONE_PAN,
        "ingredients": [
            ("계란", "3개", False, False, []),
            ("양파", "1/4개", False, True, ["대파", "쪽파"]),
            ("소금", "약간", True, False, []),
            ("식용유", "1큰술", True, False, []),
        ],
        "steps": [
            "계란을 풀고 잘게 다진 양파와 소금을 넣어 섞어요.",
            "약불로 달군 팬에 계란물을 얇게 부어요.",
            "반쯤 익으면 돌돌 말고, 남은 계란물을 부어가며 반복해요.",
        ],
    },
    {
        "title": "두부계란찜",
        "cook_minutes": 12,
        "difficulty": Difficulty.EASY,
        "cookware": Cookware.MICROWAVE,
        "ingredients": [
            ("두부", "1/2모", False, False, []),
            ("계란", "2개", False, False, []),
            ("대파", "약간", False, True, ["쪽파"]),
            ("소금", "약간", True, False, []),
        ],
        "steps": [
            "두부를 으깨고 계란·물 3큰술·소금을 넣어 잘 섞어요.",
            "전자레인지용 그릇에 담고 대파를 올려요.",
            "랩을 씌워 전자레인지에 3~4분 돌리면 완성!",
        ],
    },
    {
        "title": "양파 계란덮밥",
        "cook_minutes": 15,
        "difficulty": Difficulty.EASY,
        "cookware": Cookware.ONE_PAN,
        "ingredients": [
            ("밥", "1공기", False, False, []),
            ("양파", "1/2개", False, False, []),
            ("계란", "2개", False, False, []),
            ("간장", "2큰술", True, False, []),
            ("설탕", "1큰술", True, False, []),
        ],
        "steps": [
            "양파를 채 썰어 간장·설탕·물 4큰술과 함께 팬에서 졸여요.",
            "양파가 투명해지면 풀어둔 계란을 둘러 반숙으로 익혀요.",
            "밥 위에 올리면 완성!",
        ],
    },
    {
        "title": "스팸마요덮밥",
        "cook_minutes": 10,
        "difficulty": Difficulty.EASY,
        "cookware": Cookware.ONE_PAN,
        "ingredients": [
            ("밥", "1공기", False, False, []),
            ("스팸", "1/3캔", False, False, ["햄", "참치캔"]),
            ("계란", "1개", False, False, []),
            ("마요네즈", "적당량", True, False, []),
            ("간장", "1큰술", True, False, []),
        ],
        "steps": [
            "스팸을 깍둑썰기해 노릇하게 구워요.",
            "계란은 스크램블로 익혀요.",
            "밥 위에 스팸·계란을 올리고 간장과 마요네즈를 뿌려요.",
        ],
    },
    {
        "title": "대파 계란볶음밥",
        "cook_minutes": 15,
        "difficulty": Difficulty.EASY,
        "cookware": Cookware.ONE_PAN,
        "ingredients": [
            ("밥", "1공기", False, False, []),
            ("대파", "1대", False, False, ["쪽파", "양파"]),
            ("계란", "2개", False, False, []),
            ("간장", "1큰술", True, False, []),
            ("식용유", "2큰술", True, False, []),
        ],
        "steps": [
            "기름에 송송 썬 대파를 볶아 파기름을 내요.",
            "계란을 넣어 스크램블한 뒤 밥을 넣고 볶아요.",
            "팬 가장자리에 간장을 눌러 향을 입히면 완성!",
        ],
    },
]

# (코드, 이름, 설명, 아이콘, 조건, 목표치)
BADGES = [
    ("FRIDGE_CLEANER", "냉장고 클린러", "유통기한 내 재료 소진 10회", "🧹", BadgeCondition.SAVED_BEFORE_EXPIRY, 10),
    ("HOME_COOK_MASTER", "집밥 마스터", "요리 완료 10회", "🍳", BadgeCondition.COOK_COUNT, 10),
    ("STREAK_7", "7일 연속 기록", "7일 연속 관리", "🔥", BadgeCondition.STREAK_DAYS, 7),
    ("STREAK_30", "30일 연속", "30일 연속 관리", "🏆", BadgeCondition.STREAK_DAYS, 30),
    ("RECIPE_20", "레시피 20개 완성", "요리 완료 20회", "📖", BadgeCondition.COOK_COUNT, 20),
    ("PHOTO_10", "사진 등록 10회", "사진으로 재료 등록 10회", "📸", BadgeCondition.PHOTO_REGISTER_COUNT, 10),
]
