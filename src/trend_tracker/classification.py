"""공식 발표를 반도체 기술 분야와 채용 직무 관점으로 분류한다."""

from __future__ import annotations

import re
from typing import Iterable


CLASSIFICATION_VERSION = "job_tech_taxonomy_v4"

JOB_ROLE_ORDER = (
    "공정기술·양산기술",
    "R&D공정·공정설계",
    "설비기술·기반기술",
    "P&T·패키지개발",
    "평가분석·품질·PE",
    "소자",
    "설계",
    "AE·솔루션",
    "SW·데이터·AI",
    "인프라·안전",
    "산업·사업 공통",
)

TECH_DOMAIN_ORDER = (
    "노광·마스크",
    "식각",
    "증착·박막",
    "이온주입·열처리",
    "세정·CMP",
    "계측·검사·수율",
    "패키징·테스트",
    "DRAM·HBM",
    "NAND·스토리지",
    "파운드리·로직·소자",
    "장비·Fab·인프라",
    "소재·부품",
    "AI·데이터",
    "기업·산업 일반",
)

SIGNAL_TYPE_ORDER = (
    "기술·제품",
    "투자·생산",
    "협업·공급망",
    "경영·실적",
    "행사·인재",
    "기업·산업 일반",
)

EQUIPMENT_COMPANIES = {
    "ASML",
    "Applied Materials",
    "Lam Research",
    "Tokyo Electron",
    "KLA",
}

# 공정 직무는 단순히 process/manufacturing이라는 넓은 단어가 등장했다는
# 이유만으로 부여하지 않는다. 실제 단위 공정 분야가 잡히거나, 반도체 제조·
# 양산·생산능력처럼 공정 현업과 직접 연결되는 표현이 있는 핵심 기사에만 붙인다.
PROCESS_ROLE_STRONG_KEYWORDS = (
    "semiconductor manufacturing",
    "chip manufacturing",
    "wafer manufacturing",
    "manufacturing process",
    "process technology",
    "foundry process",
    "process milestone",
    "process milestones",
    "process roadmap",
    "process control",
    "process window",
    "mass production",
    "volume production",
    "production capacity",
    "high-volume manufacturing",
    "high volume manufacturing",
    "production line",
    "production lines",
    "manufacturing line",
    "manufacturing lines",
    "yield ramp",
    "yield improvement",
    "hybrid bonding",
    "wafer bonding",
    "back-end process",
    "back end process",
    "advanced packaging process",
    "packaging process",
    "panel-level packaging",
    "panel level packaging",
    "device prober",
    "wafer prober",
    "known good device",
    "kgd screening",
    "screening test",
    "반도체 제조",
    "반도체 생산",
    "제조 공정",
    "공정 기술",
    "공정 제어",
    "공정 조건",
    "수율 개선",
    "양산 전환",
    "양산 공정",
    "양산 라인",
    "양산 계획",
    "양산 체제",
    "양산 개시",
    "대량 생산",
    "생산 능력",
    "생산 라인",
)

PROCESS_ROLE_INDIRECT_KEYWORDS = (
    "semiconductor infrastructure",
    "dram capacity",
    "반도체 인프라",
    "디램 용량",
)

PROCESS_EVIDENCE_GROUPS = (
    (
        "반도체 제조·양산",
        (
            "semiconductor manufacturing", "chip manufacturing", "wafer manufacturing",
            "mass production", "volume production", "high-volume manufacturing",
            "high volume manufacturing", "반도체 제조", "반도체 생산", "대량 생산",
        ),
    ),
    (
        "공정 기술·제어",
        (
            "manufacturing process", "process technology", "foundry process",
            "process milestone", "process milestones", "process roadmap", "process control",
            "process window", "제조 공정", "공정 기술", "공정 제어", "공정 조건",
        ),
    ),
    (
        "수율 개선·양산 안정화",
        ("yield ramp", "yield improvement", "수율 개선", "양산 전환", "양산 공정"),
    ),
    (
        "생산능력·생산라인",
        (
            "production capacity", "production line", "production lines",
            "manufacturing line", "manufacturing lines", "생산 능력", "생산 라인",
            "양산 라인", "양산 계획", "양산 체제", "양산 개시",
        ),
    ),
    (
        "웨이퍼·하이브리드 본딩",
        ("hybrid bonding", "wafer bonding"),
    ),
    (
        "첨단 패키징 공정",
        (
            "back-end process", "back end process", "advanced packaging process",
            "packaging process", "panel-level packaging", "panel level packaging",
        ),
    ),
    (
        "검사·KGD 선별",
        ("device prober", "wafer prober", "known good device", "kgd screening", "screening test"),
    ),
)

PROCESS_INDIRECT_EVIDENCE_GROUPS = (
    ("반도체 인프라", ("semiconductor infrastructure", "반도체 인프라")),
    ("DRAM 용량·대역폭", ("dram capacity", "디램 용량")),
)

DOMAIN_KEYWORDS = {
    "노광·마스크": (
        "lithography", "euv", "duv", "high na", "photoresist", "dry resist",
        "mask", "reticle", "overlay", "patterning", "노광", "마스크",
    ),
    "식각": ("etch", "etching", "plasma dicing", "식각", "플라즈마"),
    "증착·박막": (
        "deposition", "ald", "cvd", "epitaxy", "epi", "thin film", "film metrology",
        "precursor", "증착", "박막", "에피택시",
    ),
    "이온주입·열처리": (
        "ion implantation", "ion implant", "implantation", "anneal", "annealing",
        "rapid thermal", "diffusion furnace", "thermal processing", "이온주입", "열처리", "확산",
    ),
    "세정·CMP": ("cleaning", "clean", "cmp", "polishing", "세정", "연마"),
    "계측·검사·수율": (
        "metrology", "inspection", "defect", "yield", "process control", "review system",
        "failure analysis", "reliability", "quality", "measurement", "monitoring",
        "characterization", "validation", "verification", "qualification", "process window",
        "critical dimension", "cd-sem", "wafer inspection", "평가",
        "계측", "검사", "불량", "수율",
        "품질", "측정", "검증", "신뢰성",
    ),
    "패키징·테스트": (
        "advanced packaging", "packaging", "package", "hybrid bonding", "wafer bonding",
        "chiplet", "interposer", "substrate", "2.5d", "3d integration", "3di", "test",
        "probe", "prober", "osat", "back-end", "back end", "패키지", "후공정", "테스트",
    ),
    "DRAM·HBM": (
        "hbm", "dram", "ddr5", "lpddr", "gddr", "memory bandwidth", "ai memory",
        "디램", "에이치비엠",
    ),
    "NAND·스토리지": (
        "nand", "flash memory", "3d flash", "bics", "ssd", "storage", "ufs", "nvme",
        "낸드", "플래시", "스토리지",
    ),
    "파운드리·로직·소자": (
        "foundry", "logic", "transistor", "gate-all-around", "gaa", "finfet", "process node",
        "1nm", "2nm", "3nm", "18a", "a13", "image sensor", "cis", "device physics",
        "파운드리", "로직", "소자", "트랜지스터",
    ),
    "장비·Fab·인프라": (
        "equipment", "system", "scanner", "tool", "fab", "manufacturing", "production capacity",
        "facility", "cleanroom", "plant", "lab network", "장비", "설비", "팹", "생산", "공장",
    ),
    "소재·부품": (
        "semiconductor material", "advanced material", "materials engineering", "wafer",
        "silicon carbide", "sic", "gallium nitride",
        "gan", "substrate", "chemical", "gas delivery", "component", "부품", "소재", "웨이퍼",
    ),
    "AI·데이터": (
        "artificial intelligence", " ai ", "ai-driven", "agentic ai", "machine learning",
        "big data", "data analytics", "digital twin", "automation", "robotics", "software",
        "인공지능", "빅데이터", "데이터", "자동화", "소프트웨어",
    ),
}


def _flatten(value: object) -> str:
    if isinstance(value, dict):
        return " ".join(_flatten(item) for item in value.values())
    if isinstance(value, (list, tuple, set)):
        return " ".join(_flatten(item) for item in value)
    return str(value or "")


def _analysis_evidence(article: dict) -> str:
    """검증된 공식 본문 분석에서 사실과 기술 신호만 분류 근거로 사용한다."""
    payload = article.get("ai_analysis")
    if not isinstance(payload, dict) or payload.get("validation_status") != "PASS":
        return ""
    analysis = payload.get("analysis")
    if not isinstance(analysis, dict):
        return ""

    evidence: list[object] = [analysis.get("summary_ko")]
    for fact in analysis.get("facts") or []:
        if isinstance(fact, dict):
            evidence.extend((fact.get("statement_ko"), fact.get("evidence_en")))
    evidence.append(analysis.get("technology_signals"))
    return _flatten(evidence)


def _article_text(article: dict) -> str:
    values = (
        article.get("title"),
        article.get("summary"),
        article.get("source_category"),
        _analysis_evidence(article),
    )
    return f" {' '.join(_flatten(value) for value in values).casefold()} "


def _article_core_text(article: dict) -> str:
    """기사 자체 내용만 반환한다. 뉴스룸 분류명은 직무 근거로 사용하지 않는다."""
    values = (
        article.get("title"),
        article.get("summary"),
        _analysis_evidence(article),
    )
    return f" {' '.join(_flatten(value) for value in values).casefold()} "


def _contains(text: str, keyword: str) -> bool:
    needle = keyword.casefold()
    if needle.startswith(" ") or needle.endswith(" "):
        return needle in text
    if re.fullmatch(r"[a-z0-9]+(?: [a-z0-9]+)*", needle):
        return re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", text) is not None
    return needle in text


def _has_any(text: str, keywords: Iterable[str]) -> bool:
    return any(_contains(text, keyword) for keyword in keywords)


def classify_tech_domains(article: dict) -> list[str]:
    text = _article_text(article)
    domains = [
        domain
        for domain in TECH_DOMAIN_ORDER
        if domain != "기업·산업 일반" and _has_any(text, DOMAIN_KEYWORDS[domain])
    ]
    return domains or ["기업·산업 일반"]


def classify_job_roles(article: dict, domains: list[str], relevance: str) -> list[str]:
    text = _article_text(article)
    core_text = _article_core_text(article)
    domain_set = set(domains)
    roles: list[str] = []

    unit_process_domains = {
        "노광·마스크", "식각", "증착·박막", "이온주입·열처리", "세정·CMP", "계측·검사·수율",
    }
    has_unit_process_domain = bool(domain_set & unit_process_domains)
    has_explicit_process_evidence = relevance == "high" and _has_any(
        text, PROCESS_ROLE_STRONG_KEYWORDS
    )
    has_indirect_process_evidence = relevance == "high" and _has_any(
        text, PROCESS_ROLE_INDIRECT_KEYWORDS
    )
    if (
        has_unit_process_domain
        or has_explicit_process_evidence
        or has_indirect_process_evidence
    ):
        roles.append("공정기술·양산기술")

    if relevance == "high" and (
        domain_set & unit_process_domains
        or _has_any(
            core_text,
            ("research", "development", "next-gen", "new technology", "신기술", "차세대"),
        )
    ):
        roles.append("R&D공정·공정설계")

    if (
        article.get("company") in EQUIPMENT_COMPANIES
        and relevance == "high"
        and domain_set != {"기업·산업 일반"}
    ) or _has_any(
        core_text,
        ("equipment", "tool", "scanner", "system", "maintenance", "facility", "장비", "설비"),
    ):
        roles.append("설비기술·기반기술")

    if "패키징·테스트" in domain_set:
        roles.append("P&T·패키지개발")

    if "계측·검사·수율" in domain_set or _has_any(
        text,
        (
            "test", "validation", "verification", "failure", "quality", "reliability",
            "measurement", "monitor", "characterization", "performance", "sample",
            "평가", "검증", "측정", "성능", "신뢰성",
        ),
    ):
        roles.append("평가분석·품질·PE")

    if "파운드리·로직·소자" in domain_set:
        roles.append("소자")

    if _has_any(
        text, ("design", "architecture", "circuit", "signal integrity", "interface", "controller", "설계", "아키텍처")
    ):
        roles.append("설계")

    if _has_any(
        text, ("customer", "application", "solution", "server", "cxl", "ssd", "client", "고객", "솔루션")
    ):
        roles.append("AE·솔루션")

    semiconductor_tech_domains = domain_set - {
        "기업·산업 일반",
        "장비·Fab·인프라",
        "AI·데이터",
    }
    has_direct_ai_work = _has_any(
        core_text,
        (
            "machine learning",
            "data analytics",
            "digital twin",
            "automation",
            "robotics",
            "software platform",
            "머신러닝",
            "데이터 분석",
            "디지털 트윈",
            "자동화",
            "로보틱스",
            "소프트웨어 플랫폼",
        ),
    )
    if "AI·데이터" in domain_set and (
        semiconductor_tech_domains or has_direct_ai_work
    ):
        roles.append("SW·데이터·AI")

    if _has_any(
        text, ("fab", "facility", "cleanroom", "plant", "construction", "power", "water", "gas", "chemical", "energy", "safety", "환경", "안전", "인프라")
    ):
        roles.append("인프라·안전")

    ordered = [role for role in JOB_ROLE_ORDER if role in roles]
    return ordered or ["산업·사업 공통"]


def classify_process_fit(
    article: dict, domains: list[str], relevance: str
) -> tuple[str, list[str]]:
    """공정·양산 직무와의 관련 단계와 사람이 확인할 수 있는 근거를 반환한다."""
    text = _article_text(article)
    unit_process_domains = {
        "노광·마스크", "식각", "증착·박막", "이온주입·열처리", "세정·CMP", "계측·검사·수율",
    }
    direct_evidence = [
        domain for domain in TECH_DOMAIN_ORDER if domain in unit_process_domains and domain in domains
    ]
    for label, keywords in PROCESS_EVIDENCE_GROUPS:
        if _has_any(text, keywords) and label not in direct_evidence:
            direct_evidence.append(label)

    has_strong_evidence = relevance == "high" and _has_any(
        text, PROCESS_ROLE_STRONG_KEYWORDS
    )
    if (set(domains) & unit_process_domains) or has_strong_evidence:
        return "direct", direct_evidence[:4] or ["공정·양산 명시 표현"]

    indirect_evidence = [
        label
        for label, keywords in PROCESS_INDIRECT_EVIDENCE_GROUPS
        if _has_any(text, keywords)
    ]
    if relevance == "high" and indirect_evidence:
        return "indirect", indirect_evidence[:4]
    return "background", []


def classify_signal_types(article: dict, relevance: str) -> list[str]:
    text = _article_text(article)
    signals: list[str] = []
    if relevance == "high" or _has_any(
        text, ("technology", "product", "system", "solution", "develop", "unveil", "launch", "기술", "제품", "개발")
    ):
        signals.append("기술·제품")
    if _has_any(
        text, ("invest", "capacity", "production", "manufacturing", "fab", "plant", "groundbreaking", "shipments", "투자", "생산", "양산")
    ):
        signals.append("투자·생산")
    if _has_any(
        text, ("partner", "collaboration", "agreement", "joint venture", "acquisition", "supply chain", "협력", "파트너")
    ):
        signals.append("협업·공급망")
    if _has_any(
        text, ("financial", "results", "revenue", "dividend", "investor", "board", "stock", "earnings", "실적", "매출")
    ):
        signals.append("경영·실적")
    if _has_any(
        text, ("conference", "summit", "semicon", "award", "career", "workforce", "university", "forum", "행사", "수상", "인재")
    ):
        signals.append("행사·인재")
    ordered = [signal for signal in SIGNAL_TYPE_ORDER if signal in signals]
    return ordered or ["기업·산업 일반"]


def enrich_article(article: dict) -> dict:
    enriched = dict(article)
    relevance = article.get("relevance") or "high"
    domains = classify_tech_domains(article)
    roles = classify_job_roles(article, domains, relevance)
    signals = classify_signal_types(article, relevance)
    process_fit, process_evidence = classify_process_fit(article, domains, relevance)
    enriched.update(
        {
            "relevance": relevance,
            "tech_domains": domains,
            "job_roles": roles,
            "signal_types": signals,
            "process_fit": process_fit,
            "process_evidence": process_evidence,
            "classification_version": CLASSIFICATION_VERSION,
        }
    )
    return enriched
