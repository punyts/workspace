#!/bin/bash
# bin/repos.sh: the library repos of the workspace, in build order (a library comes after the libraries it builds on).
# stateui-app and stateui-components need each other: stateui-app builds first against the components' last dist,
# and stateui-components builds its catalog against stateui-app.
REPOS=(
  core
  expression
  state
  state-sync
  state-react
  statenet
  stateui
  stateui-app
  stateui-components
  stateui-mcp
  example
)
