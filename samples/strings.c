#include <stdio.h>
#include <string.h>
#include <stdlib.h>
int inspect_input(void) {
    char input[32];
    char destination[32];
    scanf("%s", input);
    system(input);
    strcpy(destination, input);
    return 0;
}
