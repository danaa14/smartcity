"""Probe every Annex 1 starting URL: HTTP status, final URL, <title>, <html lang>. Writes corpus/annex-probe.json."""
import json, re, ssl, urllib.request, datetime, concurrent.futures as cf
ANNEX = {
 "Transparență și proiecte municipale": ["https://chisinau.md/","https://www.chisinau.md/ro/transparenta","https://suburbii.chisinau.md/","https://proiecte.chisinau.md/"],
 "Mobilitate urbană": ["https://mobilitatechisinau.md/","https://rtec.md/","https://autourban.md/ro/rute/suburbane","https://exdrupo.md/"],
 "Arhitectură, spații verzi și utilități": ["https://dgaurf.md/","https://dglca.md/","https://autosalubritate.md/informatie-de-contact/","https://www.acc.md/","https://agsv.md/diagrama-defrisare-curatare-a-arborilor-2/"],
 "Educație": ["https://chisinauedu.dgets.md/","https://detsriscani.md/","https://detsciocana.educ.md/","https://detscentru.md/","https://buiucanidets.md","https://detsbotanica.md","https://educatieonline.md/","https://extrascolar.md/","https://egradinita.md/","https://escoala.chisinau.md/"],
 "Sănătate": ["https://dgams.md/","https://help.chisinau.md/","https://amt-botanica.md/","https://amt-centru.md/","https://amtbuiucani.md/","https://amt-ciocana.md/","http://amtriscani.md/"],
 "Administrație de sector": ["https://www.botanica.md/","https://chisinaucentru.md/","https://ciocana.md/","https://rascani.md/","https://preturabuiucani.md/"],
 "Servicii — comerț, turism, investiții, tineret": ["https://comert.chisinau.md/","https://visit.chisinau.md/","https://invest.chisinau.md/","https://proiecte.chisinau.md/ro/pv-289-startup-pentru-tineri-si-migranti","https://e-tineret.md/"],
 "Alte servicii publice": ["http://www.infocom.md/","https://liftservice.md/"],
}
ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
def probe(cat,url):
    r={"category":cat,"startUrl":url,"probedAt":datetime.datetime.utcnow().isoformat()+"Z"}
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (pe-fir prototype research)"})
        with urllib.request.urlopen(req,timeout=20,context=ctx) as resp:
            body=resp.read(400000).decode("utf-8","replace")
            r.update(status=resp.status,finalUrl=resp.geturl())
            m=re.search(r"<title[^>]*>(.*?)</title>",body,re.S|re.I); r["title"]=re.sub(r"\s+"," ",m.group(1)).strip() if m else None
            m=re.search(r"<html[^>]*\blang=[\"']?([\w-]+)",body,re.I); r["lang"]=m.group(1) if m else None
            r["bytes"]=len(body); r["looksJsOnly"]= len(re.sub(r"<script.*?</script>|<[^>]+>","",body,flags=re.S).split())<60
    except Exception as e:
        r.update(status="error",error=str(e)[:200])
    return r
jobs=[(c,u) for c,us in ANNEX.items() for u in us]
with cf.ThreadPoolExecutor(12) as ex: out=list(ex.map(lambda a:probe(*a),jobs))
json.dump(out,open("corpus/annex-probe.json","w"),ensure_ascii=False,indent=1)
for r in out: print(r["status"], r["startUrl"], "|", (r.get("title") or r.get("error",""))[:70], "|", r.get("lang"), "| jsonly" if r.get("looksJsOnly") else "")
