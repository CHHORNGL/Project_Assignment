import csv
import json
from datetime import date
from decimal import Decimal
from pathlib import Path

import psycopg2


def _load_database_url() -> str:
    env_path = Path('.env')
    if not env_path.exists():
        raise SystemExit('Missing .env file')

    db_url = None
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('DATABASE_URL='):
            db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
            break

    if not db_url:
        raise SystemExit('DATABASE_URL not found in .env')

    if db_url.startswith('postgresql+psycopg2://'):
        db_url = 'postgresql://' + db_url.split('postgresql+psycopg2://', 1)[1]

    return db_url


def _normalize(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def main() -> None:
    db_url = _load_database_url()
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute(
        '''
        SELECT id, source_title, source_org, publication_year, source_type, source_url, accessed_at
        FROM mixed_agri_sources
        ORDER BY id;
        '''
    )
    source_cols = [desc[0] for desc in cur.description]
    sources = [dict(zip(source_cols, row)) for row in cur.fetchall()]

    cur.execute(
        '''
        SELECT id, source_id, topic, region, fact_text, metric_value, metric_unit, metric_year
        FROM mixed_agri_facts
        ORDER BY id;
        '''
    )
    fact_cols = [desc[0] for desc in cur.description]
    facts = [dict(zip(fact_cols, row)) for row in cur.fetchall()]

    out_dir = Path('exports') / 'mixed_agri'
    out_dir.mkdir(parents=True, exist_ok=True)

    sources_csv = out_dir / 'mixed_agri_sources.csv'
    facts_csv = out_dir / 'mixed_agri_facts.csv'
    snapshot_json = out_dir / 'mixed_agri_snapshot.json'

    with sources_csv.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=source_cols)
        writer.writeheader()
        for row in sources:
            writer.writerow(row)

    with facts_csv.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fact_cols)
        writer.writeheader()
        for row in facts:
            writer.writerow(row)

    facts_by_source = {}
    for fact in facts:
        fact = {k: _normalize(v) for k, v in fact.items()}
        facts_by_source.setdefault(fact['source_id'], []).append(fact)

    snapshot = {
        'exported_at': date.today().isoformat(),
        'sources': []
    }

    for source in sources:
        source_id = source['id']
        source_payload = dict(source)
        source_payload['accessed_at'] = (
            source_payload['accessed_at'].isoformat()
            if source_payload.get('accessed_at')
            else None
        )
        source_payload['facts'] = facts_by_source.get(source_id, [])
        snapshot['sources'].append(source_payload)

    snapshot_json.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding='utf-8')

    cur.close()
    conn.close()

    print(f'Exported {len(sources)} sources and {len(facts)} facts to {out_dir}.')


if __name__ == '__main__':
    main()
