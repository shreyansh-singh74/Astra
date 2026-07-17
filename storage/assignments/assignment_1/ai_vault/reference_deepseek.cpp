#include <vector>
#include <cstdlib>

bool solveDelivery(std::vector<std::pair<int,int>> route, std::vector<std::pair<int,int>> pads) {
    int p = 100;
    size_t len = route.size();
    for(size_t i = 1; i < len; ++i) {
        p -= abs(route[i].first - route[i-1].first) + abs(route[i].second - route[i-1].second);
        if(p <= 0) return false;
        
        bool charged = false;
        for(size_t j = 0; j < pads.size(); ++j) {
            if(pads[j] == route[i]) { charged = true; break; }
        }
        p = charged ? 100 : p;
    }
    return true;
}
