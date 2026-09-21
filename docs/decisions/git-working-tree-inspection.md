# Read-only Git working-tree inspection

Changes are read as one bounded status observation. A separate batch request reads diffs only for the staged or unstaged files the reader opened, using one Git process per scope rather than one per file. Untracked and conflict entries remain explicit; binary files and unsupported submodule changes never return misleading text.

Git paths must be lossless UTF-8 and retain their exact spelling. Reads disable external diff helpers, text conversion, replacement objects, lazy fetching, and terminal prompts. Assigned conversion filters are rejected rather than silently showing unconverted content. This is protection against ordinary trusted local writers, not a sandbox against a hostile process changing Git configuration between checks.

The status token identifies the status observation, not file contents. Every selected path therefore carries a fingerprint over both relevant sides, modes, symlink targets, and submodule commit where applicable. Diff reads re-establish fingerprints and filesystem change stamps before and after Git runs; a moved stamp or changed observation refuses the answer. These checks bind returned hunks to what was observed, but cannot make externally mutable files an atomic snapshot.

Working-file fingerprints are read through the filesystem boundary without following links. Checkout identity is reconfirmed around every response. Output, path count, and response sizes are bounded; exceeding a bound or encountering an unsupported encoding fails explicitly rather than truncating the review.
