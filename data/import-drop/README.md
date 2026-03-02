# Trip Import Drop Folder

Use this folder to share trip data for conversion/import.

## Put your files here

- Required: one main trip file in `raw/` (csv/tsv/txt/js/ts/json is all fine)
- Optional: one places file in `raw/`
- Optional: a short note in `raw/notes.txt` about special columns or assumptions

Example names:

- `raw/my-trip-source.csv`
- `raw/my-places-source.tsv`
- `raw/legacy-trip-data.ts`

## If you want direct admin import

You can also fill:

- `trip-template.csv` (required)
- `places-template.csv` (optional)

Then upload those files in Admin Console -> `Spreadsheet Import`.

## Supported direct-import date/time formats

- Date: `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, or `21 Jan`
- Time: `HH:MM` (or `HH:MM:SS`)

