#!/usr/bin/env bash
# Source this file so Maven and the application use the same JDK.
if [ "$(uname -s)" = Darwin ] && /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
  JAVA_HOME="$(/usr/libexec/java_home -v 21)"
  export JAVA_HOME
fi
if [ -n "${JAVA_HOME:-}" ]; then
  PATH="$JAVA_HOME/bin:$PATH"
  export PATH
fi
if ! java -version 2>&1 | head -1 | grep -Eq 'version "21[.\"]'; then
  echo 'CodeSentinel requires JDK 21. Set JAVA_HOME to a JDK 21 installation.' >&2
  return 1 2>/dev/null || exit 1
fi
