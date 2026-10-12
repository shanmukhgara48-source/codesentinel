int adjust(int value);
int adjust(int value) {
    int offset = 2;
    {
        int offset = 5;
        value += offset;
    }
    return value + offset;
}
