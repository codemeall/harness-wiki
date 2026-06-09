# The LLM Wiki pattern

An LLM Wiki is a persistent, structured, interlinked collection of markdown files
that sits between you and your raw sources. Unlike file-upload RAG — which
retrieves raw chunks at query time and answers from scratch on every call — the
wiki compiles knowledge once and keeps it current.

When you add a new source, the agent reads it, extracts the key information, and
integrates it into the existing wiki: updating entity pages, revising syntheses,
flagging contradictions, and maintaining cross-references. The knowledge is a
compounding artifact. The cross-references are already there; the contradictions
have already been flagged; the synthesis already reflects everything read.

You curate sources and ask questions. The agent does the bookkeeping —
summarizing, cross-referencing, filing, and keeping the index and log current.
You never (or rarely) write the wiki yourself.

The pattern was described by Andrej Karpathy as an idea file meant to be handed
to an LLM agent, which then builds out the specifics in collaboration with you.
Useful for deep research over weeks, reading a book and building a companion
wiki, or an internal team knowledge base fed by transcripts and documents.
