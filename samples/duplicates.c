int first(int value) {
    int total = 0;
    for (int i = 0; i < 5; i++) {
        total += value + i;
    }
    return total;
}
int second(int value) {
    int total = 0;
    for (int i = 0; i < 5; i++) {
        total += value + i;
    }
    return total;
}
int renamed(int number) {
    int result = 0;
    for (int index = 0; index < 5; index++) {
        result += number + index;
    }
    return result;
}
