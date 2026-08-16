from Backend.db import connect

conn = connect()
mappings = {
    'akuntansi': 'sp_akt',
    'manajemen': 'sp_mnj',
    'hukum': 'sp_hkm',
    'komunikasi': 'sp_kom',
    'administrasi': 'sp_adm',
    'pemerintahan': 'sp_ipem',
    'pgsd': 'sp_pgsd',
    'informasi': 'sp_sif',
}

total = 0
for key, sp_id in mappings.items():
    cur = conn.execute('''
        UPDATE students
        SET study_program_id = ?
        WHERE lower(coalesce(program_study, '')) LIKE ?
          AND (study_program_id IS NULL OR study_program_id = '')
    ''', (sp_id, f'%{key}%'))
    total += cur.rowcount

conn.commit()
print('Total linked students:', total)

for r in conn.execute('''
    SELECT sp.code, sp.name, count(s.id) as cnt
    FROM study_programs sp
    LEFT JOIN students s ON s.study_program_id = sp.id AND s.deleted_at IS NULL
    GROUP BY sp.id
    ORDER BY cnt DESC
''').fetchall():
    print(r['code'], r['name'], '->', r['cnt'], 'mahasiswa')
