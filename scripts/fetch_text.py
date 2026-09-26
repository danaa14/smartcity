"""Fetch a URL and save raw HTML + visible text to corpus/raw/<slug>.{html,txt}. Usage: fetch_text.py slug url"""
import sys, re, ssl, urllib.request, html, datetime, json, os
slug,url=sys.argv[1],sys.argv[2]
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (pe-fir prototype research)","Accept-Language":"ro,ru;q=0.8"})
with urllib.request.urlopen(req,timeout=30,context=ctx) as r:
    raw=r.read(); final=r.geturl(); ctype=r.headers.get("content-type","")
os.makedirs("corpus/raw",exist_ok=True)
if "pdf" in ctype or url.lower().endswith(".pdf"):
    open(f"corpus/raw/{slug}.pdf","wb").write(raw); print("PDF saved",len(raw)); sys.exit()
body=raw.decode("utf-8","replace")
open(f"corpus/raw/{slug}.html","w").write(body)
t=re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>","",body)
t=re.sub(r"(?i)<br\s*/?>|</(p|div|li|h\d|tr|td|th|section|article|header|footer|a)>","\n",t)
t=html.unescape(re.sub(r"<[^>]+>"," ",t))
lines=[re.sub(r"[ \t\xa0]+"," ",l).strip() for l in t.split("\n")]
lines=[l for l in lines if l]
out=[];[out.append(l) for l in lines if not out or out[-1]!=l]
open(f"corpus/raw/{slug}.txt","w").write("\n".join(out))
meta={"slug":slug,"url":url,"finalUrl":final,"retrievedAt":datetime.datetime.utcnow().isoformat()+"Z"}
m=re.search(r"<title[^>]*>(.*?)</title>",body,re.S|re.I); meta["title"]=html.unescape(re.sub(r"\s+"," ",m.group(1)).strip()) if m else None
json.dump(meta,open(f"corpus/raw/{slug}.meta.json","w"),ensure_ascii=False)
print(meta["title"], len(out),"lines")
