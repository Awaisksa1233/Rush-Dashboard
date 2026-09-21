import os

target = 'M3QC'
for f in os.listdir('.'):
    if f.endswith('.csv'):
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            content = fp.read()
            if target in content:
                print(f"Found in CSV: {f}")
print("Done checking all CSVs.")
