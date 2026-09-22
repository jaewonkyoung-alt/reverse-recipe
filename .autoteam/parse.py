#!/usr/bin/env python3
"""평가자 JSON 출력 파서. 사용: parse.py <verdict|p1|cost> <파일>"""
import json, sys

def load(path):
    """grok 은 {structuredOutput:{...}} 를, Claude 폴백은 평가 JSON 을 그대로 낸다.
    둘 다 받아 같은 모양으로 돌려준다."""
    try:
        raw = open(path, encoding="utf-8", errors="replace").read()
    except Exception:
        return {}
    try:
        d = json.loads(raw)
    except Exception:
        import re
        m = re.search(r"\{.*\}", raw, re.S)
        if not m:
            return {}
        try:
            d = json.loads(m.group(0))
        except Exception:
            return {}
    if isinstance(d, dict) and "structuredOutput" not in d and "verdict" in d:
        return {"structuredOutput": d, "total_cost_usd": 0}
    return d if isinstance(d, dict) else {}

# 커밋 전 비밀값 스캔.
# 주의: Google API 키는 형식이 둘이다. 구형 AIza...(39자)와
# 신형 AQ.A...(53자). 2026-09 발급분은 신형이라 AIza 패턴만 쓰면 놓친다.
SECRET_PATTERNS = {
    "Google API key (AIza)": r"AIza[0-9A-Za-z_\-]{35}",
    "Google API key (AQ.)":  r"\bAQ\.[A-Za-z0-9_\-]{40,}",
    "GitHub token":          r"gh[pousr]_[0-9A-Za-z]{36}",
    "xAI key":               r"\bxai-[0-9A-Za-z]{20,}",
    "OpenAI key":            r"\bsk-[A-Za-z0-9_\-]{20,}",
    "AWS access key":        r"\bAKIA[0-9A-Z]{16}\b",
    "Slack token":           r"\bxox[abprs]-[0-9A-Za-z\-]{10,}",
    "Private key block":     r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
}


def scan(path):
    """파일 하나를 검사해 (라벨, 미리보기) 목록을 낸다."""
    import re
    hits = []
    try:
        text = open(path, encoding="utf-8", errors="replace").read()
    except Exception:
        return hits
    for label, pat in SECRET_PATTERNS.items():
        for m in re.finditer(pat, text):
            line = text[:m.start()].count("\n") + 1
            hits.append((label, line))
    return hits


def main():
    what, path = sys.argv[1], sys.argv[2]
    if what == "scan":
        hits = scan(path)
        for label, line in hits:
            print("%s:%d  %s" % (path, line, label))
        sys.exit(1 if hits else 0)

    doc = load(path)
    out = doc.get("structuredOutput", {})

    if what == "verdict":
        print(out.get("verdict", ""))
    elif what == "cost":
        print("%.4f" % (doc.get("total_cost_usd") or 0))
    elif what == "p1":
        for i, x in enumerate(out.get("p1", []), 1):
            print("%d. %s — %s" % (i, x.get("problem", ""), x.get("location", "")))
            if x.get("why"):
                print("   왜 P1: %s" % x["why"])
            print("   수정 방향: %s" % x.get("fix", ""))
    elif what == "summary":
        print(out.get("summary", ""))

if __name__ == "__main__":
    main()
