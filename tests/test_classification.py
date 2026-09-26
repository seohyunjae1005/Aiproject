"""직무 분류의 대표적인 과대 분류와 정상 분류를 검사한다."""

from __future__ import annotations

import unittest

from trend_tracker.classification import enrich_article


PROCESS_ROLE = "공정기술·양산기술"


def article(title: str, summary: str, *, relevance: str = "high", company: str = "Applied Materials") -> dict:
    return {
        "company": company,
        "title": title,
        "summary": summary,
        "source_category": "Official newsroom",
        "relevance": relevance,
    }


class ProcessRoleClassificationTest(unittest.TestCase):
    def assert_process(self, row: dict) -> None:
        self.assertIn(PROCESS_ROLE, enrich_article(row)["job_roles"])

    def assert_not_process(self, row: dict) -> None:
        self.assertNotIn(PROCESS_ROLE, enrich_article(row)["job_roles"])

    def test_research_center_collaboration_is_not_process_role(self) -> None:
        self.assert_not_process(
            article(
                "UC Berkeley to Join Applied Materials' EPIC Center to Speed Chip Innovation",
                "A collaboration using equipment and process integration expertise in an R&D environment.",
            )
        )

    def test_smart_glasses_context_article_is_not_process_role(self) -> None:
        self.assert_not_process(
            article(
                "Applied Materials Unveils a Visual System for Next-Gen Smart Glasses",
                "A scalable manufacturing solution for augmented reality displays.",
                relevance="context",
            )
        )

    def test_semiconductor_manufacturing_is_process_role(self) -> None:
        self.assert_process(
            article(
                "Samsung Electronics and ASML Expand Strategic Collaboration",
                "The companies will collaborate on next-generation semiconductor manufacturing.",
                company="Samsung Electronics",
            )
        )

    def test_unit_process_domain_is_process_role(self) -> None:
        self.assert_process(
            article(
                "Industry Readiness for High-NA EUV",
                "High-NA EUV lithography and overlay control for advanced nodes.",
                company="ASML",
            )
        )

    def test_hybrid_bonding_is_process_role(self) -> None:
        self.assert_process(
            article(
                "Hybrid Bonding Improves Semiconductor Performance",
                "Advanced packaging, back-end process, HBM4 and hybrid bonding.",
                company="SK hynix",
            )
        )

    def test_foundry_process_milestone_is_process_role(self) -> None:
        self.assert_process(
            article(
                "Intel Foundry Details Process Milestones",
                "Future innovation at a semiconductor technology symposium.",
                company="Intel",
            )
        )

    def test_production_capacity_is_process_role_only_for_high_relevance(self) -> None:
        high = article(
            "New Fab Expands Production Capacity",
            "The new wafer facility expands production capacity.",
            company="Kioxia",
        )
        context = dict(high, relevance="context")
        self.assert_process(high)
        self.assert_not_process(context)


if __name__ == "__main__":
    unittest.main()
