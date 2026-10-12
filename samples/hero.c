#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* One program, every stage. This source is analyzed, never executed. */
int review_submission(void) {
    int base = 2 * 8 + 1;
    int score = base + 3;

    char name[16];
    char destination[16];
    char *scratch = malloc(64);

    /* A supported allocation-failure guard. */
    if (scratch == NULL) {
        return 1;
    }

    /* Deliberate source-level risks for the audit demonstration. */
    scanf("%s", name);
    strcpy(destination, name);

    for (int i = 0; i < 3; i++) {
        if (i == 1) {
            continue;
        }
        score += i;
    }

    free(scratch);

    if (score > 10) {
        return score;
    } else {
        return 0;
    }
}
