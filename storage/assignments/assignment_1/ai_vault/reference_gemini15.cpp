#include <vector>
#include <cmath>

bool checkRouteSafety(std::vector<std::pair<int, int>>& r, std::vector<std::pair<int, int>>& c) {
    int b = 100;
    for(int idx = 0; idx < (int)r.size() - 1; idx++) {
        b -= (std::abs(r[idx].first - r[idx+1].first) + std::abs(r[idx].second - r[idx+1].second));
        if(b <= 0) return false;
        
        for(const auto& pad : c) {
            if(pad.first == r[idx+1].first && pad.second == r[idx+1].second) {
                b = 100;
                break;
            }
        }
    }
    return true;
}
