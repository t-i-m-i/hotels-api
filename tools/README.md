# Tools & Scripts

Standalone scripts for running one-off tasks against the database without spinning up the Nest HTTP
server.

## Structure

```
tools/
├── data/                        # Input CSVs for import scripts
├── import-hotels-from-csv.ts    # Bulk-insert hotels from a CSV into the `hotels` table
└── README.md
```
