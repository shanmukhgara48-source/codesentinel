#include <stdio.h>
int read_name(void) {
    char name[16];
    scanf("%15s", name);
    printf("Hello %s\n", name);
    return 0;
}
