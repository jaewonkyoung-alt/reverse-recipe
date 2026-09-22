#!/usr/bin/env python3
"""평가자 JSON 출력 파서. 사용: parse.py <verdict|p1|cost> <파일>"""
import json, sys

def load(path):
    try:
        return json.load(open(path))
    except Exception:
        return {}

def main():
    what, path = sys.argv[1], sys.argv[2]
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
