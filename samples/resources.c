#include <stdlib.h>
int checked(void) {
    char *buffer = malloc(64);
    if (buffer == NULL) return 1;
    free(buffer);
    return 0;
}
int review_needed(void) {
    char large[2048];
    char *buffer = malloc(64);
    for (int i = 0; i < 3; i++) {
        char *chunk = calloc(8, 1);
        free(chunk);
    }
    return 0;
}
char *transfer_ownership(void) {
    char *buffer = malloc(32);
    return buffer;
}
