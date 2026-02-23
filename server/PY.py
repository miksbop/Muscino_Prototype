import json
d=json.load(open('/tmp/sleeves.json'))
rows=[song for sleeve in d for song in sleeve.get('contents',[])]
print("rows",len(rows))
print("missing_spotifyTrackId",sum(1 for r in rows if not r.get("spotifyTrackId")))
print("missing_coverUrl",sum(1 for r in rows if not r.get("coverUrl")))
print("sample",rows[:3])