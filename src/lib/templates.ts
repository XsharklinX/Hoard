export interface NoteTemplate {
  id: string
  label: string
  icon: string
  markdown: string
}

const today = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting',
    label: 'Meeting Notes',
    icon: '📋',
    markdown: `# Meeting Notes

**Date:** ${today()}
**Attendees:**

## Agenda

-

## Discussion

## Action Items

- [ ]
- [ ]

## Notes

`
  },
  {
    id: 'daily',
    label: 'Daily Log',
    icon: '📅',
    markdown: `# Daily Log — ${today()}

## Done

-

## In Progress

-

## Tomorrow

-

## Notes

`
  },
  {
    id: 'bug',
    label: 'Bug Report',
    icon: '🐛',
    markdown: `# Bug Report

**Summary:**

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

## Actual Behavior

## Environment

- OS:
- Version:

## Notes

`
  },
  {
    id: 'idea',
    label: 'Idea',
    icon: '💡',
    markdown: `# Idea:

**Problem:**

**Solution:**

**Why it matters:**

## Next Steps

- [ ]
- [ ]

## Resources

`
  },
  {
    id: 'research',
    label: 'Research Notes',
    icon: '🔬',
    markdown: `# Research:

**Source:**
**Date:** ${today()}

## Key Points

-
-

## Quotes

>

## Questions

-

## References

`
  }
]
