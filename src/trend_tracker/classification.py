"""공식 발표를 반도체 기술 분야와 채용 직무 관점으로 분류한다."""

from __future__ import annotations

import re
from typing import Iterable


CLASSIFICATION_VERSION = "job_tech_taxonomy_v1"

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
        "material", "materials", "wafer", "silicon carbide", "sic", "gallium nitride",
        "gan", "substrate", "chemical", "gas delivery", "component", "부품", "소재", "웨이퍼",
    ),
    "AI·데이터": (
        "artificial intelligence", " ai ", "ai-driven", "agentic ai", "machine learning",
        "big data", "data analytics", "digital twin", "automation", "robotics", "software",
        "인공지능", "빅데이터", "데이터", "자동화", "소프트웨어",
    ),
}


def _flatten(value: object) -> str:
    if isinstance(value, (list, tuple, set)):
        return " ".join(str(item) for item in value)
    return str(value or "")


def _article_text(article: dict) -> str:
    values = (
        article.get("title"),
        article.get("summary"),
        article.get("matched_keywords"),
        article.get("source_category"),
    )
    return f" {' '.join(_flatten(value) for value in values).casefold()} "


def _contains(text: str, keyword: str) -> bool:
    needle = keyword.casefold()
    if needle.startswith(" ") or needle.endswith(" "):
        return needle in text
    if len(needle) <= 3 and needle.isalnum():
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
    domain_set = set(domains)
    roles: list[str] = []

    unit_process_domains = {
        "노광·마스크", "식각", "증착·박막", "이온주입·열처리", "세정·CMP", "계측·검사·수율",
    }
    if domain_set & unit_process_domains or _has_any(
        text, ("process", "mass production", "manufacturing", "recipe", "공정", "양산")
    ):
        roles.append("공정기술·양산기술")

    if relevance == "high" and (
        domain_set & unit_process_domains
        or _has_any(text, ("research", "development", "next-gen", "new technology", "innovation", "신기술", "차세대"))
    ):
        roles.append("R&D공정·공정설계")

    if (
        article.get("company") in EQUIPMENT_COMPANIES and relevance == "high"
    ) or _has_any(
        text,
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

    if "AI·데이터" in domain_set:
        roles.append("SW·데이터·AI")

    if _has_any(
        text, ("fab", "facility", "cleanroom", "plant", "construction", "power", "water", "gas", "chemical", "energy", "safety", "환경", "안전", "인프라")
    ):
        roles.append("인프라·안전")

    ordered = [role for role in JOB_ROLE_ORDER if role in roles]
    return ordered or ["산업·사업 공통"]


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
    enriched.update(
        {
            "relevance": relevance,
            "tech_domains": domains,
            "job_roles": roles,
            "signal_types": signals,
            "classification_version": CLASSIFICATION_VERSION,
        }
    )
    return enriched
