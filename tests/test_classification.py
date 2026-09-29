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

    def test_device_prober_is_process_role(self) -> None:
        row = enrich_article(
            article(
                "Tokyo Electron Releases a New Device Prober",
                "The KGD screening test uses precise thermal control to improve final yield.",
                company="Tokyo Electron",
            )
        )
        self.assertIn(PROCESS_ROLE, row["job_roles"])
        self.assertEqual(row["process_fit"], "direct")
        self.assertIn("검사·KGD 선별", row["process_evidence"])

    def test_semiconductor_infrastructure_is_indirect_process_signal(self) -> None:
        self.assert_process(
            article(
                "Strategic Partnership for Intelligence-Driven Semiconductor Infrastructure",
                "Official semiconductor newsroom announcement.",
                company="Samsung Electronics",
            )
        )

    def test_dram_capacity_is_an_indirect_process_signal(self) -> None:
        row = enrich_article(
            article(
                "Redefining local AI computing",
                "DRAM capacity and bandwidth set the ceiling for edge AI performance.",
                company="Micron",
            )
        )
        self.assertIn(PROCESS_ROLE, row["job_roles"])
        self.assertEqual(row["process_fit"], "indirect")
        self.assertEqual(row["process_evidence"], ["DRAM 용량·대역폭"])

    def test_gpu_memory_bandwidth_is_not_a_process_signal(self) -> None:
        row = enrich_article(
            article(
                "How query types shape GPU demand, memory, and power",
                "We profile GPU memory bandwidth, power, throughput, and energy efficiency.",
                company="Micron",
            )
        )
        self.assertNotIn(PROCESS_ROLE, row["job_roles"])
        self.assertEqual(row["process_fit"], "background")
        self.assertEqual(row["process_evidence"], [])

    def test_validated_server_performance_facts_are_not_process_evidence(self) -> None:
        row = article(
            "Generational performance for the application server",
            "A server combines DDR5 memory and an NVMe SSD.",
            company="Micron",
        )
        row["ai_analysis"] = {
            "validation_status": "PASS",
            "analysis": {
                "summary_ko": "서버용 메모리와 SSD의 성능을 비교한다.",
                "facts": [
                    {
                        "statement_ko": "최고 메모리 대역폭을 높였다.",
                        "evidence_en": "raises the memory bandwidth",
                    },
                    {
                        "statement_ko": "최초의 양산형 PCIe Gen6 SSD 중 하나다.",
                        "evidence_en": "among the first production PCIe Gen6 data center SSDs",
                    },
                ],
                "technology_signals": ["DDR5 DRAM", "NVMe SSD"],
            },
        }
        self.assert_not_process(row)

    def test_validated_official_facts_can_supply_process_evidence(self) -> None:
        row = article(
            "Image Sensor Joint Venture",
            "Official press center announcement.",
            company="TSMC",
        )
        row["ai_analysis"] = {
            "validation_status": "PASS",
            "analysis": {
                "summary_ko": "첨단 공정기술을 이용한 이미지센서 양산을 준비한다.",
                "facts": [
                    {
                        "statement_ko": "신규 생산 라인에서 양산을 추진한다.",
                        "evidence_en": "development and production lines for image sensors",
                    }
                ],
                "technology_signals": ["advanced manufacturing process technology"],
                "role_insights": [
                    {
                        "role": "공정기술·양산기술",
                        "study_points_ko": ["기사에 없는 수율 조건"],
                    }
                ],
            },
        }
        self.assert_process(row)

    def test_unvalidated_analysis_is_not_classification_evidence(self) -> None:
        row = article(
            "Corporate Partnership",
            "General business update.",
            company="TSMC",
        )
        row["ai_analysis"] = {
            "validation_status": "FAIL",
            "analysis": {
                "summary_ko": "공정 제어와 수율 개선",
                "facts": [],
                "technology_signals": [],
            },
        }
        self.assert_not_process(row)

    def test_generic_equipment_company_ai_story_has_no_specialized_job(self) -> None:
        row = article(
            "The machines behind the machines",
            "Discover how ASML is applying AI-native engineering for the next technology era.",
            company="ASML",
        )
        self.assertEqual(enrich_article(row)["job_roles"], ["산업·사업 공통"])

    def test_ai_newsroom_category_alone_does_not_create_ai_job(self) -> None:
        row = article(
            "Intel Invests EUR 5 Billion to Expand Manufacturing in Europe",
            "Official Intel Newsroom category: Artificial Intelligence (AI)",
            company="Intel",
        )
        row["source_category"] = "Artificial Intelligence (AI)"
        self.assertEqual(enrich_article(row)["job_roles"], ["산업·사업 공통"])

    def test_broad_innovation_language_does_not_create_rnd_or_ai_jobs(self) -> None:
        row = article(
            "America 250: Intel is Advancing U.S. Innovation, AI, and Manufacturing",
            "Official Intel Newsroom category: Artificial Intelligence (AI)",
            company="Intel",
        )
        row["source_category"] = "Artificial Intelligence (AI)"
        self.assertEqual(enrich_article(row)["job_roles"], ["산업·사업 공통"])


if __name__ == "__main__":
    unittest.main()
